import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_FAVORITES, MY_SEED_LOGS, type Category, type Log } from "./data";

interface Account {
  email: string;
  username: string;
}

interface StoreValue {
  ready: boolean;
  account: Account | null;
  myLogs: Log[];
  favorites: Record<Category, string>;
  addLog: (l: Omit<Log, "id" | "userId" | "createdAt" | "likes">) => void;
  setFavorite: (c: Category, mediaId: string) => void;
  signUp: (a: Account) => void;
  signOut: () => void;
  deleteAccount: () => void;
  logModal: { open: boolean; mediaId?: string };
  openLog: (mediaId?: string) => void;
  closeLog: () => void;
  watchlist: string[];
  toggleWatchlist: (mediaId: string) => void;
  detailId: string | null;
  openDetail: (mediaId: string) => void;
  closeDetail: () => void;
}

const Ctx = createContext<StoreValue | null>(null);
const KEY = "hobbybox:v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [myLogs, setMyLogs] = useState<Log[]>(MY_SEED_LOGS);
  const [favorites, setFavorites] = useState<Record<Category, string>>(DEFAULT_FAVORITES);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ open: boolean; mediaId?: string }>({ open: false });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.account !== undefined) setAccount(s.account);
        if (Array.isArray(s.myLogs)) setMyLogs(s.myLogs);
        if (Array.isArray(s.watchlist)) setWatchlist(s.watchlist);
        if (s.favorites) setFavorites({ ...DEFAULT_FAVORITES, ...s.favorites });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ account, myLogs, favorites, watchlist })).catch(() => {});
  }, [ready, account, myLogs, favorites, watchlist]);

  const addLog = useCallback<StoreValue["addLog"]>((l) => {
    setMyLogs((prev) => [{ ...l, id: `me-${Date.now()}`, userId: "me", createdAt: Date.now(), likes: 0 }, ...prev]);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      account,
      myLogs,
      favorites,
      addLog,
      setFavorite: (c, id) => setFavorites((f) => ({ ...f, [c]: id })),
      signUp: (a) => setAccount(a),
      signOut: () => setAccount(null),
      deleteAccount: () => {
        setAccount(null);
        setMyLogs(MY_SEED_LOGS);
        setFavorites(DEFAULT_FAVORITES);
        setWatchlist([]);
      },
      logModal,
      openLog: (mediaId) => setLogModal({ open: true, mediaId }),
      closeLog: () => setLogModal({ open: false }),
      watchlist,
      toggleWatchlist: (id) => setWatchlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [id, ...w])),
      detailId,
      openDetail: (id) => setDetailId(id),
      closeDetail: () => setDetailId(null),
    }),
    [ready, account, myLogs, favorites, addLog, logModal, watchlist, detailId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
