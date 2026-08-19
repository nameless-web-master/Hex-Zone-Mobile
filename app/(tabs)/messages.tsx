import { Redirect, useLocalSearchParams } from "expo-router";

/** Legacy route: Home is now the messages inbox. */
export default function MessagesAlias() {
  const params = useLocalSearchParams();
  return (
    <Redirect
      href={{
        pathname: "/(tabs)",
        params,
      }}
    />
  );
}
