"use client";

import { useActionState, useEffect, useState } from "react";
import { connectSteam } from "@/app/connect/actions";
import { saveLibrary, saveProfile } from "@/lib/library";
import { AddGames } from "@/components/add-games";
import { TagEnricher } from "@/components/tag-enricher";

export function SteamConnect({ demoMode = false }: { demoMode?: boolean }) {
  const [state, action, pending] = useActionState(connectSteam, null);
  // Bumped whenever we rewrite the stored library, so the tag enricher re-reads
  // what still needs fetching.
  const [libVersion, setLibVersion] = useState(0);

  // Persist the imported library so the picker (/play) can recommend from it.
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
    <div className="space-y-6">
      <TagEnricher version={libVersion} />

      <form action={action} className="card p-6">
        <label
          htmlFor="steam"
          className="text-sm font-medium text-foreground"
        >
          Your Steam profile
        </label>
        <p className="mt-1 text-sm text-muted">
          Paste your SteamID64, your full profile URL, or your custom URL name.
          Your profile must be public to read playtime.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            id="steam"
            name="steam"
            autoComplete="off"
            placeholder="76561198… or steamcommunity.com/id/yourname"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-subtle focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pending
              ? "Importing…"
              : demoMode
                ? "Preview sample"
                : "Import library"}
          </button>
        </div>
        <p className="mt-3 font-mono text-xs text-subtle">
          Tip: find your SteamID64 at steamid.io if you only know your name.
        </p>
      </form>

      {state && state.ok === false && (
        <div className="card border-amber/30 bg-amber/5 p-4 text-sm text-amber">
          {state.error}
        </div>
      )}

      {state && state.ok && (
        <div className="space-y-5">
          {state.isMock && (
            <div className="rounded-xl border border-border bg-accent-dim px-4 py-2.5 text-xs text-accent-soft">
              Demo data — no <code className="font-mono">STEAM_API_KEY</code> set
              yet, so this is a sample import. Add the key to pull a real
              library.
            </div>
          )}

          <div className="card flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent to-[#38bdf8] text-base font-semibold text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {state.profile.avatar ? (
                <img
                  src={state.profile.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                state.profile.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{state.profile.name}</p>
              <p className="font-mono text-xs text-subtle">
                {state.profile.steamId} · {state.games.length} games
              </p>
            </div>
            <span className="rounded-full border border-green/30 bg-green/10 px-3 py-1 text-xs font-medium text-green">
              Connected
            </span>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">
              Imported library · sorted by playtime
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {state.games.map((g) => (
                <div key={g.appid} className="card card-hover overflow-hidden">
                  <div className="aspect-[460/215] w-full bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.coverUrl}
                      alt={g.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">{g.name}</p>
                    <p className="mt-1 font-mono text-xs text-subtle">
                      {g.playtimeMin > 0
                        ? `${Math.round(g.playtimeMin / 60)}h played`
                        : "never played"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
