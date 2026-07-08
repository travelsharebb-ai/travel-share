import { useLanguage } from "../lib/i18n";
import { useParams } from "react-router-dom";

export default function ShareAlbum() {
  const { t } = useLanguage();
  const { token } = useParams();

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel max-w-4xl">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.sharedAlbum")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("hardcoded.travelShareAlbum")}</h1>
        <p className="mt-4 max-w-2xl text-slatebody leading-7">{t("hardcoded.aPublicAlbumSharedWithYouUseThe")}</p>
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">{t("hardcoded.albumToken")}</h2>
        <p className="mt-3 rounded-3xl border border-borderline bg-slate-900 p-4 text-slatebody break-words">{token}</p>
        <p className="mt-4 text-slatebody">{t("hardcoded.photosAndVideosWillAppearHereOnceThe")}</p>
      </section>
    </main>
  );
}

// Styling is provided by the old Travel Share class-based theme.