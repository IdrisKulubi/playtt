import { useFocusEffect } from "expo-router"
import { useCallback, useRef, useState } from "react"

import { fetchCommunityMe, fetchCommunityPlayers } from "@/lib/community-api"
import type {
  CommunityMe,
  CommunityPlayer,
  CommunityPlayersFilters,
  CommunitySkillLevel,
  CommunityVenueRef,
} from "@/lib/community-types"

const PLAYER_LIST_REFRESH_MS = 30_000

export type CommunitySegment = "open" | "everyone" | "following"

export function communityFilters(
  segment: CommunitySegment,
  skill: CommunitySkillLevel | null,
  doubles: boolean,
): CommunityPlayersFilters {
  return {
    status: segment === "open" ? "open" : "all",
    following: segment === "following" || undefined,
    skill: skill ?? undefined,
    doubles: doubles || undefined,
  }
}

export function useCommunityMe() {
  const [me, setMe] = useState<CommunityMe | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setMe(await fetchCommunityMe())
      setError(null)
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  return { me, setMe, error, loading, reload }
}

type PlayersState = {
  players: CommunityPlayer[]
  venue: CommunityVenueRef | null
  nextCursor: string | null
}

const EMPTY_PLAYERS: PlayersState = { players: [], venue: null, nextCursor: null }

/**
 * Player list for the Community tab. Refetches on focus and every 30 s while
 * the screen is focused; `enabled` stays false until the viewer has a card.
 */
export function useCommunityPlayers(filters: CommunityPlayersFilters, enabled: boolean) {
  const [state, setState] = useState<PlayersState>(EMPTY_PLAYERS)
  // Filters the current rows (or error) belong to; differs while new filters load.
  const [settledKey, setSettledKey] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const filterKey = JSON.stringify(filters)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    if (!enabled) {
      return
    }

    const id = ++requestId.current
    try {
      const page = await fetchCommunityPlayers(JSON.parse(filterKey) as CommunityPlayersFilters)
      if (id === requestId.current) {
        setState({ players: page.players, venue: page.venue, nextCursor: page.nextCursor })
        setError(null)
      }
    } catch (nextError) {
      if (id === requestId.current) setError(nextError)
    } finally {
      if (id === requestId.current) setSettledKey(filterKey)
    }
  }, [enabled, filterKey])

  const loadMore = useCallback(async () => {
    if (!state.nextCursor || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const page = await fetchCommunityPlayers({
        ...(JSON.parse(filterKey) as CommunityPlayersFilters),
        cursor: state.nextCursor,
      })
      if (id === requestId.current) {
        setState((current) => ({
          venue: page.venue,
          nextCursor: page.nextCursor,
          players: [
            ...current.players,
            ...page.players.filter((player) => !current.players.some((p) => p.id === player.id)),
          ],
        }))
      }
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoadingMore(false)
    }
  }, [filterKey, loadingMore, state.nextCursor])

  useFocusEffect(
    useCallback(() => {
      void reload()
      const timer = setInterval(() => void reload(), PLAYER_LIST_REFRESH_MS)
      return () => clearInterval(timer)
    }, [reload]),
  )

  const loading = enabled && settledKey !== filterKey
  return { ...state, players: loading ? [] : state.players, loading, loadingMore, error, reload, loadMore }
}
