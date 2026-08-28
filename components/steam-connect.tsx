"use client";

import { useActionState, useEffect, useState } from "react";
import { connectSteam } from "@/app/connect/actions";
import { saveLibrary, saveProfile } from "@/lib/library";
import { AddGames } from "@/components/add-games";
import { CoverArt } from "@/components/cover-art";
import { TagEnricher } from "@/components/tag-enricher";
import { useI18n } from "@/i18n/context";

export function SteamConnect({ demoMode = false }: { demoMode?: boolean }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState(connectSteam, null);
  // Bumped whenever we rewrite the stored library, so the tag enricher re-reads
  // what still needs fetching.
  const [libVersion, setLibVersion] = useState(0);
  const t = d.connect;

  // Persist the imported library so the board (/play) can draw from it.
  useEffect(() => {
    if (state?.ok) {
      saveLibrary(
        state.games.map((g) => ({
          appid: g.appid,
          name: g.name,
          playtimeMin: g.playtimeMin,
          coverUrl: g.coverUrl,
          recentMin: g.recentMin ?? 0,
          tags: g.tags ?? [],
        }))
      );
      setLibVersion((v) => v + 1);
      // Keep the SteamID so we can refresh recent-play data later without a re-import.
      if (!state.isMock && state.profile.steamId) {
        saveProfile({ steamId: state.profile.steamId });
      }
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-5">
      <TagEnricher version={libVersion} />

      <form action={action} className="card flex flex-col gap-3 p-5">
        <label
          htmlFor="steam"
          className="mono text-[10px] uppercase tracking-[0.14em] text-subtle"
        >
          {t.form.label}
        </label>
        <p className="text-[14px] leading-relaxed text-muted">{t.form.line}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="steam"
            name="steam"
            type="text"
            autoComplete="off"
            placeholder={t.form.placeholder}
            className="min-h-11 flex-1"
          />
          <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
            {pending ? t.form.pending : demoMode ? t.form.preview : t.form.submit}
            {!pending && <span className="arrow">→</span>}
          </button>
        </div>

        <p className="mono text-[10px] uppercase tracking-[0.08em] text-subtle">
          {t.form.hint}
        </p>
      </form>

      {state && state.ok === false && (
        <p className="card border-accent-line p-4 text-[14px] leading-relaxed">
          {state.error}
        </p>
      )}

      {state && state.ok && (
        <div className="flex flex-col gap-5">
          {state.isMock && (
            <p className="mono card-quiet p-3 text-[10.5px] uppercase leading-relaxed tracking-[0.08em] text-subtle">
              {t.imported.mock}
            </p>
          )}

          <div className="card flex items-center gap-3 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-btn bg-surface2">
              {state.profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.profile.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="poster text-[18px]">
                  {state.profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="poster truncate text-[17px]">{state.profile.name}</p>
              <p className="mono mt-1 text-[10px] uppercase tracking-[0.1em] text-subtle">
                {t.imported.games(state.games.length)}
              </p>
            </div>
            <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-accent-soft">
              {t.imported.connected}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {t.imported.top}
            </span>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {state.games.slice(0, 12).map((g) => (
                <li key={g.appid} className="tile">
                  <span className="relative block aspect-[2/3] w-full">
                    <CoverArt appid={g.appid} name={g.name} sizes="120px" />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-[11.5px] text-muted">
                    {g.name}
                  </span>
                </li>
              ))}
            </ul>
            {state.games.length > 12 && (
              <p className="mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                {t.imported.more(state.games.length - 12)}
              </p>
            )}
          </div>

          <AddGames
            seed={state.games.map((g) => ({
              appid: g.appid,
              name: g.name,
              playtimeMin: g.playtimeMin,
              coverUrl: g.coverUrl,
              tags: g.tags ?? [],
            }))}
          />
        </div>
      )}
    </div>
  );
}
