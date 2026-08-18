const fs = require('fs');
const https = require('https');

const key = "sk-MlNvLNWN87cdAuSOSCxvoWaG5dBhKGkOi2X40SWDOf1a1jMB";

function testAPI(hostname) {
  const data = JSON.stringify({
    model: "moonshot-v1-8k",
    messages: [{ role: "user", content: "ok" }],
    max_tokens: 5
  });

  const options = {
    hostname: hostname,
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'Content-Length': data.length
    }
  };

  const req = https.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log(`Response from ${hostname}: ${res.statusCode}`);
      console.log(body);
    });
  });

  req.on('error', error => {
    console.error(error);
  });

  req.write(data);
  req.end();
}

testAPI('api.moonshot.cn');
testAPI('api.moonshot.ai');
