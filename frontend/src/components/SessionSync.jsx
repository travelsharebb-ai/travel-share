import { useEffect } from "react";

export default function SessionSync() {
  useEffect(() => {
    console.log("Session sync active");
  }, []);

  return null;
}