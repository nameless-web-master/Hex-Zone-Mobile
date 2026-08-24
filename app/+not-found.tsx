import { Redirect } from "expo-router";

/** Recover from launch URLs that Expo Router could not match (e.g. scheme-only). */
export default function NotFound() {
  return <Redirect href="/" />;
}
