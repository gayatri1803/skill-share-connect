import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user1, user2 } = await req.json();
    
    console.log("Generating match reason for:", { user1, user2 });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are a helpful assistant that explains why two people would make great skill swap partners.

User 1 (${user1.name}):
- Can teach: ${user1.skillsOffered.join(", ") || "None listed"}
- Wants to learn: ${user1.skillsWanted.join(", ") || "None listed"}

User 2 (${user2.name}):
- Can teach: ${user2.skillsOffered.join(", ") || "None listed"}  
- Wants to learn: ${user2.skillsWanted.join(", ") || "None listed"}

Write a short, friendly, and encouraging explanation (1-2 sentences) about why these two would be great skill swap partners. Focus on the complementary skills they can exchange. Be specific about which skills match up.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a friendly matchmaker for a skill exchange platform. Keep responses concise and encouraging." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please try again later." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const reason = data.choices[0]?.message?.content || "These users have complementary skills that could lead to a great exchange!";

    console.log("Generated reason:", reason);

    return new Response(
      JSON.stringify({ reason }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-match-reason:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
