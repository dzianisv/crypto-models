// Netlify serverless function to proxy a small subset of CoinGecko endpoints
// This avoids CORS problems in the browser and centralizes API calls server-side.
// Supported query params:
// - type=markets&ids=comma,separated,ids&vs=usd
// - type=market_chart&id=coinId&days=7&vs=usd

exports.handler = async function(event) {
  try {
    const q = event.queryStringParameters || {};
    const type = q.type || 'markets';

    let url = null;
    if (type === 'markets') {
      const ids = q.ids || '';
      const vs = q.vs || 'usd';
      url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(vs)}&ids=${encodeURIComponent(ids)}&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
    } else if (type === 'market_chart') {
      const id = q.id;
      const vs = q.vs || 'usd';
      const days = q.days || '7';
      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'missing id parameter for market_chart' })
        };
      }
      url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=${encodeURIComponent(days)}`;
    } else {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'unsupported type' })
      };
    }

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
