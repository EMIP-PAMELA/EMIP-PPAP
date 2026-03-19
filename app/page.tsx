import { supabase } from "@/src/lib/supabaseClient";

export default async function Home() {
  const { data, error } = await supabase
    .from("ppap_records")
    .select("*")
    .limit(5);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        EMIP-PPAP Dashboard
      </h1>

      {error && (
        <p className="text-red-500">
          Error: {error.message}
        </p>
      )}

      <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
