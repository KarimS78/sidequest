"use client";

import { useActionState, useEffect, useState } from "react";
import { connectSteam } from "@/app/connect/actions";
import { saveLibrary, saveProfile } from "@/lib/library";
import { AddGames } from "@/components/add-games";
import { CoverArt } from "@/components/cover-art";
import { TagEnricher } from "@/components/tag-enricher";

export function SteamConnect({ demoMode = false }: { demoMode?: boolean }) {
  const [state, action, pending] = useActionState(connectSteam, null);
  // Bumped whenever we rewrite the stored library, so the tag enricher re-reads
  // what still needs fetching.
  const [libVersion, setLibVersion] = useState(0);

  // Persist the imported library so the deck (/play) can pick from it.
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
    <div className="space-y-5">
      <TagEnricher version={libVersion} />

      <form action={action} className="border border-line p-3.5">
        <label
          htmlFor="steam"
          className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft"
        >
          Your Steam profile
        </label>
        <p className="mt-1.5 text-sm leading-relaxed text-[#b3c0c7]">
          Paste your SteamID64, your profile URL, or your custom URL name. The
          profile has to be public to read playtime.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="steam"
            name="steam"
            autoComplete="off"
            placeholder="76561198… or steamcommunity.com/id/yourname"
            className="min-h-11 flex-1 rounded-[2px] border border-line bg-transparent px-3 text-[13px] text-label outline-none transition-colors placeholder:text-[#5b6a72] focus:border-contacts"
          />
          <button
            type="submit"
            disabled={pending}
            className="switch h-11 w-auto shrink-0 px-5 font-display text-[17px] font-extrabold uppercase tracking-[0.12em] disabled:opacity-60"
          >
            {pending ? "Reading…" : demoMode ? "Preview" : "Import"}
          </button>
        </div>
        <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#5b6a72]">
          Find your SteamID64 at steamid.io if you only know your name
        </p>
      </form>

      {state && state.ok === false && (
        <p className="border border-challenge/40 bg-challenge/10 p-3 text-sm leading-relaxed text-label">
          {state.error}
        </p>
      )}

      {state && state.ok && (
        <div className="space-y-5">
          {state.isMock && (
            <p className="border border-line p-2.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-ink-soft">
              Demo data — no STEAM_API_KEY set, so this is a sample shelf
            </p>
          )}

          <div className="flex items-center gap-3 border border-line p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-gradient-to-br from-shell to-shell-dark font-display text-[20px] font-extrabold text-ink">
              {state.profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.profile.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                state.profile.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[20px] font-bold uppercase leading-none">
                {state.profile.name}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
                {state.games.length} carts racked
              </p>
            </div>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-contacts">
              Connected
            </span>
          </div>

          <div>
            <p className="rule">Racked · by playtime</p>
            <div className="grid grid-cols-3 gap-2">
              {state.games.slice(0, 12).map((g) => (
                <div key={g.appid} className="cart !rounded-[6px_6px_2px_2px] !p-1.5 !pb-0">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[2px] bg-paper">
                    <CoverArt appid={g.appid} name={g.name} sizes="120px" />
                  </div>
                  <p className="truncate px-px py-1 font-display text-[11px] font-bold uppercase leading-none text-ink">
                    {g.name}
                  </p>
                </div>
              ))}
            </div>
            {state.games.length > 12 && (
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
                +{state.games.length - 12} more on the shelf
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
