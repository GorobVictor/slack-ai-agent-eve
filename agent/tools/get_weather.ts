import { defineTool } from "eve/tools";
import { z } from "zod";

const WMO_WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    country: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>;
};

type ForecastResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  current_units: {
    temperature_2m: string;
    apparent_temperature: string;
    relative_humidity_2m: string;
    precipitation: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
};

export default defineTool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    cityName: z.string().describe("City name, e.g. Kyiv or London"),
  }),
  async execute(input) {
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.searchParams.set("name", input.cityName);
    geocodingUrl.searchParams.set("count", "1");
    geocodingUrl.searchParams.set("language", "en");
    geocodingUrl.searchParams.set("format", "json");

    const geocodingRes = await fetch(geocodingUrl);
    if (!geocodingRes.ok) {
      throw new Error(`Geocoding request failed with status ${geocodingRes.status}`);
    }

    const geocoding = (await geocodingRes.json()) as GeocodingResponse;
    const location = geocoding.results?.[0];
    if (!location) {
      throw new Error(`City not found: ${input.cityName}`);
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
      ].join(",")
    );

    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) {
      throw new Error(`Weather request failed with status ${forecastRes.status}`);
    }

    const forecast = (await forecastRes.json()) as ForecastResponse;
    const { current, current_units: units } = forecast;

    return {
      city: location.name,
      region: location.admin1,
      country: location.country,
      observedAt: current.time,
      temperature: `${current.temperature_2m}${units.temperature_2m}`,
      feelsLike: `${current.apparent_temperature}${units.apparent_temperature}`,
      humidity: `${current.relative_humidity_2m}${units.relative_humidity_2m}`,
      precipitation: `${current.precipitation}${units.precipitation}`,
      windSpeed: `${current.wind_speed_10m}${units.wind_speed_10m}`,
      windDirection: `${current.wind_direction_10m}°`,
      condition:
        WMO_WEATHER_DESCRIPTIONS[current.weather_code] ??
        `Weather code ${current.weather_code}`,
    };
  },
});
