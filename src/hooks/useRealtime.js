import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query as fsQuery } from "firebase/firestore";

/**
 * useRealtime(refOrQuery, constraints?)
 * - DocumentReference -> retorna {id, ...data} | null
 * - CollectionReference/Query -> retorna Array
 */
export default function useRealtime(refOrQuery, constraints = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const q = useMemo(() => {
    if (!refOrQuery) return null;
    if (constraints?.length) return fsQuery(refOrQuery, ...constraints);
    return refOrQuery;
  }, [refOrQuery, JSON.stringify(constraints || [])]);

  useEffect(() => {
    if (!q) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      q,
      (snap) => {
        // DocumentSnapshot
        if (typeof snap?.exists === "function") {
          setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
          return;
        }

        // QuerySnapshot
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error("useRealtime error:", err);
        setData(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [q]);

  return { data, loading };
}
