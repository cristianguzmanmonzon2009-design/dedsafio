export default function Background({ url }: { url?: string | null }) {
  return (
    <>
      <div className="bg-layer" />
      {url ? (
        <div className="bg-image" style={{ backgroundImage: `url(${url})` }} />
      ) : null}
      <div className="bg-vignette" />
    </>
  );
}
