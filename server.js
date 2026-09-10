import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || 'localhost';
const WEATHER_CODES = {
  0: ['Clear sky', 'clear'],
  1: ['Mainly clear', 'clear'],
  2: ['Partly cloudy', 'cloudy'],
  3: ['Overcast', 'cloudy'],
  45: ['Foggy', 'fog'],
  48: ['Rime fog', 'fog'],
  51: ['Light drizzle', 'rain'],
  53: ['Drizzle', 'rain'],
  55: ['Heavy drizzle', 'rain'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  80: ['Rain showers', 'rain'],
  81: ['Rain showers', 'rain'],
  82: ['Heavy showers', 'rain'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Thunderstorm with hail', 'storm']
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

async function getWeather(city) {
  const locationResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  if (!locationResponse.ok) throw new Error('Location service is unavailable.');

  const locationData = await locationResponse.json();
  const location = locationData.results?.[0];
  if (!location) return null;

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    forecast_days: '7',
    timezone: 'auto'
  });

  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) throw new Error('Forecast service is unavailable.');
  const forecast = await forecastResponse.json();

  return {
    location: {
      name: location.name,
      country: location.country,
      admin: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: forecast.timezone
    },
    current: {
      ...forecast.current,
      condition: WEATHER_CODES[forecast.current.weather_code]?.[0] || 'Unknown',
      icon: WEATHER_CODES[forecast.current.weather_code]?.[1] || 'cloudy'
    },
    daily: forecast.daily,
    hourly: forecast.hourly
  };
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || HOST}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/weather') {
    const city = requestUrl.searchParams.get('city')?.trim();
    if (!city) {
      sendJson(response, 400, { error: 'Please provide a city.' });
      return;
    }

    try {
      const weather = await getWeather(city);
      if (!weather) {
        sendJson(response, 404, { error: `We could not find a place called "${city}".` });
        return;
      }
      sendJson(response, 200, weather);
    } catch (error) {
      console.error(error);
      sendJson(response, 502, { error: 'Weather data is temporarily unavailable. Try again shortly.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Route not found.' });
});

server.listen(PORT, HOST, () => {
  console.log(`Weather API running at http://${HOST}:${PORT}`);
});
