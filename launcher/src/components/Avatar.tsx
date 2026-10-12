import { useState } from "react";

export default function Avatar({ username }: { username: string }) {
  const [failed, setFailed] = useState(false);
  const initial = username.charAt(0).toUpperCase();
  if (failed) return <div className="avatar">{initial}</div>;
  return (
    <div className="avatar">
      <img
        src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`}
        alt={username}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
