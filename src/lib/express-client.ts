const EXPRESS_URL = process.env.EXPRESS_API_URL || "http://localhost:3001";

export async function expressFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${EXPRESS_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Express API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
