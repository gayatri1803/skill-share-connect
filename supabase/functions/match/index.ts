import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase environment variables not configured");
    }

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          authorization: req.headers.get("authorization") || "",
          apikey: supabaseKey,
        },
      },
    });

    const { learnerSkill, learnerProfile, mentorProfiles }: {
      learnerSkill: string;
      learnerProfile: any;
      mentorProfiles: any[];
    } = await req.json();

    if (!learnerSkill || !Array.isArray(mentorProfiles)) {
      return new Response(
        JSON.stringify({ error: "learnerSkill and mentorProfiles are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const matches = [];

    for (const mentor of mentorProfiles) {
      const prompt = `You are an expert AI matching system for a skill-sharing platform. Your task is to analyze compatibility between a learner and potential mentors using a comprehensive 100-point scoring system.

**LEARNER PROFILE:**
- Desired skill: ${learnerSkill}
- Additional profile: ${JSON.stringify(learnerProfile || {})}

**MENTOR PROFILE:**
- Name: ${mentor.full_name}
- Bio: ${mentor.bio || 'No bio provided'}
- Skills they teach: ${JSON.stringify(mentor.skills_offered || [])}
- Skills they want to learn: ${JSON.stringify(mentor.skills_wanted || [])}

**SCORING CRITERIA (Total: 100 points):**

1. **SKILL EXPERTISE (40 points max):**
   - Does mentor list "${learnerSkill}" in skills_offered? (+20 points)
   - Does bio indicate expertise/experience in "${learnerSkill}"? (+10 points)
   - Does bio mention teaching, mentoring, or sharing knowledge? (+10 points)

2. **MUTUAL BENEFIT (30 points max):**
   - Does learner have skills mentor wants to learn? (+15 points)
   - Is there overlap between learner's offered skills and mentor's wanted skills? (+15 points)
   - Bonus for multiple matching skills

3. **COMPATIBILITY (15 points max):**
   - Similar interests mentioned in bio (+5 points)
   - Complementary personality/learning styles (+5 points)
   - Similar teaching/learning philosophy (+5 points)

4. **LOCATION/PROXIMITY (10 points max):**
   - Same city/area = 10 points
   - Same region/state = 5 points
   - Different location = 0 points (online learning still possible)

5. **EXPERIENCE MATCHING (5 points max):**
   - Mentor experience level suitable for learner needs (+3 points)
   - Beginner-friendly indicators (+2 points)

**INSTRUCTIONS:**
- Be generous with scoring - focus on potential for positive learning exchange
- Consider online learning possibilities even for distant locations
- Look for teaching enthusiasm and willingness to help others
- A good match doesn't need to be perfect in all categories

**OUTPUT FORMAT:**
Return ONLY valid JSON with no markdown, preamble, or additional text:
{
  "score": <number 0-100>,
  "explanation": "<2-3 sentence explanation of the match quality and key reasons>"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Parse the JSON response, handling potential markdown formatting
      let parsed;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : text;
        parsed = JSON.parse(jsonText);
      } catch (e) {
        console.error('Failed to parse AI response:', text);
        parsed = { score: 50, explanation: "Unable to determine match quality" };
      }

      matches.push({
        mentorId: mentor.user_id,
        mentorName: mentor.full_name,
        skillsOffered: mentor.skills_offered,
        matchPercentage: Math.min(100, Math.max(0, parsed.score || 0)),
        explanation: parsed.explanation || "No explanation provided"
      });
    }

    // Sort by match percentage descending
    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in match function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});