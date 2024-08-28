import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

function CallForm() {
  const [externalNumber, setExternalNumber] = useState('');
  const [callStatus, setCallStatus] = useState('대기 중');
  const [newcalldata, setNewcalldata] = useState('');
  const [callStatus2, setCallStatus2] = useState({});
  const [cdrData, setCdrData] = useState([]);
  const [currentRecording, setCurrentRecording] = useState(null);

  //수신부재는 외부에거걸려온전화를못받았을떄 즉 우리상담사가 고객의 전화를못받았을떄
  //발신부재는 고객이 우리의전화를 받지못했을떄
  useEffect(() => {
    const fetchCdrData = async () => {
      try {
        const response = await axios.get('http://172.30.1.78:3001/cdr');
        console.log(response.data, 'response.data');

        // QueueData와 나머지 데이터를 별도로 필터링
        const queueData = response.data.filter(
          (cdr) => cdr.lastapp === 'Queue'
        );
        const otherData = response.data.filter(
          (cdr) => cdr.lastapp !== 'Queue'
        );

        // 중복 제거 로직
        const uniqueQueueData = Array.from(
          new Set(queueData.map((cdr) => JSON.stringify(cdr)))
        ).map((item) => JSON.parse(item));

        const uniqueOtherData = Array.from(
          new Set(otherData.map((cdr) => JSON.stringify(cdr)))
        ).map((item) => JSON.parse(item));

        const QueueData = uniqueQueueData.reduce((acc, cdr) => {
          if (!acc[cdr.uniqueid]) {
            acc[cdr.uniqueid] = [];
          }
          acc[cdr.uniqueid].push(cdr);
          return acc;
        }, {});

        const processedQueueData = Object.values(QueueData)
          .filter((cdrs) => Array.isArray(cdrs))
          .map((cdrs) => {
            let 발신자 = '';
            let 수신자 = '';
            const answeredCall = cdrs.find(
              (cdr) => cdr.disposition === 'ANSWERED'
            );
            if (answeredCall !== undefined) {
              let match = answeredCall.dstchannel.match(/\/(\d+)-/);
              if (match) {
                수신자 = match[1];
              }
            }
            const result = answeredCall || cdrs[0];
            if (수신자 === '') {
              수신자 = result.dst;
            }
            발신자 = result.src;
            let 상태 = callStatusFunction(result).상태;
            const formattedDuration =
              callStatusFunction(result).formattedDuration;

            return { ...result, 발신자, 수신자, 상태, formattedDuration };
          });

        const transformedData = uniqueOtherData.map((cdr) => {
          let 발신자 = cdr.src;
          let 수신자 = cdr.dst;
          let 상태 = callStatusFunction(cdr).상태;
          const formattedDuration = callStatusFunction(cdr).formattedDuration;

          return { ...cdr, 발신자, 수신자, 상태, formattedDuration };
        });

        let fullData = [...transformedData, ...processedQueueData];
        fullData.sort((a, b) => new Date(b.calldate) - new Date(a.calldate));
        console.log(fullData, 'fullData');

        setCdrData(fullData);
      } catch (error) {
        console.error('Failed to fetch CDR data', error);
      }
    };

    fetchCdrData();
  }, [newcalldata]);

  let callStatusFunction = (data) => {
    let 상태 = '';
    if (data.disposition === 'ANSWERED') {
      상태 = '통화완료';
    } else if (data.disposition === 'BUSY') {
      상태 = '이미 통화중인 상태입니다.';
    } else if (data.disposition === 'FAILED') {
      상태 = '실패';
    }

    // 발신자와 수신자에 따라 부재중 상태를 구분
    if (data.disposition === 'NO ANSWER') {
      if (data.dst.length === 4 || data.dst.includes('0708019')) {
        상태 = '상담사가 전화를 받지 못했습니다 (수신부재)';
      } else if (data.dst.includes('010')) {
        상태 = '고객님이전화를받지못했습니다 (발신부재)';
      }
    }
    // 통화 시간을 분과 초로 변환
    const minutes = Math.floor(data.duration / 60);
    const seconds = data.duration % 60;
    const formattedDuration =
      minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

    return { 상태, formattedDuration };
  };

  useEffect(() => {
    const socket = io('http://localhost:3001');

    socket.on('connection', () => {
      console.log('Connected to socket sㅁㄴㅇㅁㄴㅇerver');
    });

    socket.on('callStatus', (data) => {
      setNewcalldata(data);

      //   if (data.callfail === "통화가 종료되었습니다.") {
      //     setNewcalldata("");
      //   }

      switch (data.통화상태) {
        case 'Ringing':
          setCallStatus('발신 중...');
          break;
        case 'Up':
          setCallStatus('통화 중');
          break;
        case 'Busy':
          setCallStatus('수신자가 통화 중입니다.');
          break;
        case 'No Answer':
          setCallStatus('부재중');
          break;
        default:
          setCallStatus('대기 중');
          break;
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  console.log(newcalldata);

  const handleNumberClick = (number) => {
    setExternalNumber((prev) => prev + number);
  };

  const handleClear = () => {
    setExternalNumber('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await axios.post('http://localhost:3001/call', {
        externalNumber: externalNumber,
      });

      alert('성공');
      setExternalNumber(''); // 호출 후 번호 초기화
    } catch (error) {
      alert('실패');
    }
  };
  function isMatchingCallData1(newcalldata) {
    return (
      newcalldata.발신자 === '07080196410' ||
      newcalldata.수신자 === '07080196410' ||
      newcalldata.발신자 === '2848' ||
      newcalldata.수신자 === '2848'
    );
  }
  function isMatchingCallData2(newcalldata) {
    return (
      newcalldata.발신자 === '07080196412' ||
      newcalldata.수신자 === '07080196412' ||
      newcalldata.발신자 === '3333' ||
      newcalldata.수신자 === '3333'
    );
  }
  const handlePlayRecording = (recordingFile) => {
    setCurrentRecording(`/recordings/${recordingFile}`); // 서버의 녹취 파일 경로로 설정
  };

  //   if (loading) return <p>Loading...</p>;
  //   if (error) return <p>{error}</p>;

  console.log(cdrData);
  return (
    <div>
      <div className='dialer'>
        <div className='display'>
          <input
            type='text'
            value={externalNumber}
            readOnly
            placeholder='전화번호'
          />
        </div>
        <div className='buttons'>
          <button onClick={() => handleNumberClick('1')}>1</button>
          <button onClick={() => handleNumberClick('2')}>2</button>
          <button onClick={() => handleNumberClick('3')}>3</button>
          <button onClick={() => handleNumberClick('4')}>4</button>
          <button onClick={() => handleNumberClick('5')}>5</button>
          <button onClick={() => handleNumberClick('6')}>6</button>
          <button onClick={() => handleNumberClick('7')}>7</button>
          <button onClick={() => handleNumberClick('8')}>8</button>
          <button onClick={() => handleNumberClick('9')}>9</button>
          <button onClick={() => handleNumberClick('*')}>*</button>
          <button onClick={() => handleNumberClick('0')}>0</button>
          <button onClick={() => handleNumberClick('#')}>#</button>
          <button onClick={handleClear}>Clear</button>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <button type='submit'>전화 걸기</button>
      </form>
      <div
        style={{
          display: 'flex',
          justifyContent: 'between',
          alignItems: 'center',
          width: '100%',
          height: '300px',
          border: '1px solid black',
          borderRadius: '10px',
          margin: '10px',
          fontSize: '0.8em',
        }}
      >
        {' '}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '50%',
            flexDirection: 'column',
            height: '100%',
            fontSize: '1.0em',
          }}
        >
          <h3>오윤창,정해일</h3>
          {isMatchingCallData1(newcalldata) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '50%',
                flexDirection: 'column',
                height: '100%',
                fontSize: '0.8em',
              }}
            >
              <div>{newcalldata.channel}</div>
              <div>발신자:{newcalldata.발신자}</div>
              <div>수신자:{newcalldata.수신자}</div>
              <div>{newcalldata.statusresponse}</div>
              <div>{newcalldata.callstatus}</div>
              <div>{newcalldata.통화상태}</div>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '50%',
            flexDirection: 'column',
            height: '100%',
            fontSize: '1.0em',
          }}
        >
          <h3>이동현</h3>
          {isMatchingCallData2(newcalldata) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '50%',
                flexDirection: 'column',
                height: '100%',
                fontSize: '1.0em',
              }}
            >
              <div>{newcalldata.channel}</div>
              <div>발신자:{newcalldata.발신자}</div>
              <div>수신자:{newcalldata.수신자}</div>
              <div>{newcalldata.statusresponse}</div>
              <div>{newcalldata.callstatus}</div>
              <div>{newcalldata.통화상태}</div>
              <div>{newcalldata.callfail}</div>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          width: '100%',
          height: '400px',
          justifyContent: 'center',
          display: 'flex',
          alignItemsL: 'center',
        }}
      >
        <div className='cdr-table'>
          <h2>통화 기록 (CDR)</h2>
          {currentRecording && (
            <div>
              <h3>현재 재생 중: {currentRecording}</h3>
              <audio controls src={currentRecording} autoPlay />
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>통화 날짜</th>
                <th>발신자</th>
                <th>수신자</th>
                <th>통화 상태</th>
                <th>통화 시간 (초)</th>
                <th>녹취파일</th>
              </tr>
            </thead>
            <tbody>
              {cdrData.map((cdr, index) => (
                <tr key={index}>
                  <td>{cdr.calldate}</td>
                  <td>{cdr.발신자}</td>
                  <td>{cdr.수신자}</td>
                  <td>{cdr.상태}</td>
                  <td>{cdr.formattedDuration}</td>
                  <td>
                    {cdr.recordingfile ? (
                      <audio controls>
                        <source src={cdr.recordingUrl} type='audio/wav' />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      'No recording available'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style jsx>{`
        .dialer {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 20px;
        }
        .display {
          margin-bottom: 10px;
        }
        .display input {
          width: 200px;
          text-align: center;
          font-size: 1.5em;
        }
        .buttons {
          display: grid;
          grid-template-columns: repeat(3, 60px);
          gap: 10px;
        }
        .buttons button {
          width: 60px;
          height: 60px;
          font-size: 1.5em;
        }
      `}</style>
      <style jsx>{`
        .cdr-table {
          width: 7 60%;
          margin: 20px auto;
          border-collapse: collapse;
        }
        h2 {
          text-align: center;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          padding: 10px;
          text-align: center;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tbody tr {
          border-bottom: 1px solid #ddd;
        }
        tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tbody tr td:first-child {
          font-size: 1.5em;
        }
      `}</style>
    </div>
  );
}

export default CallForm;
