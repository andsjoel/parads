import feedBanner from "../assets/app-backgrounds/bg-banner-feed.png";

export default function Feed() {
  return (
    <main className="min-h-screen pb-28 text-white">
      <section className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <img
          src={feedBanner}
          alt=""
          className="block aspect-[3/1] w-full object-cover"
        />
      </section>
    </main>
  );
}
