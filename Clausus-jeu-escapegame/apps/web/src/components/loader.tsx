import { Screen } from "./screen";

/** Waiting for the session: the veil over the room, nothing else. */
export default function Loader() {
  return (
    <Screen>
      <p className="cl-wait">…</p>
    </Screen>
  );
}
