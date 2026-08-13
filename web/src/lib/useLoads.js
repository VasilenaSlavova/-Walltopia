import { useEffect, useState } from "react";
import { api } from "../api";

// module-level cache so the tables are fetched once per session
let cache = null;

export function useLoads() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache) return;
    api.loads().then((d) => { cache = d; setData(d); }).catch((e) => setError(e));
  }, []);
  return { data, error };
}
