import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

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

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a helpful assistant that explains why two people would make great skill swap partners.

User 1 (${user1.name}):
- Can teach: ${user1.skillsOffered.join(", ") || "None listed"}
- Wants to learn: ${user1.skillsWanted.join(", ") || "None listed"}

User 2 (${user2.name}):
- Can teach: ${user2.skillsOffered.join(", ") || "None listed"}  
- Wants to learn: ${user2.skillsWanted.join(", ") || "None listed"}

Write a short, friendly, and encouraging explanation (1-2 sentences) about why these two would be great skill swap partners. Focus on the complementary skills they can exchange. Be specific about which skills match up.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reason = response.text().trim() || "These users have complementary skills that could lead to a great exchange!";

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
