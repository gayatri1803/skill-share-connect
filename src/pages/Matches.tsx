import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  MessageSquare, 
  Loader2, 
  ArrowRight,
  UserPlus,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MatchedUser {
  id: string;
  user_id: string;
  full_name: string;
  bio: string;
  location: string;
  skills_offered: string[];
  skills_wanted: string[];
  match_reason?: string;
  matchId?: string;
  status?: string;
}

export default function MatchesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [potentialMatches, setPotentialMatches] = useState<MatchedUser[]>([]);
  const [existingMatches, setExistingMatches] = useState<MatchedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReasons, setGeneratingReasons] = useState<Set<string>>(new Set());

  const fetchMatches = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch user's skills
      const { data: mySkillsOffered } = await supabase
        .from("skills_offered")
        .select("skill_name")
        .eq("user_id", user.id);

      const { data: mySkillsWanted } = await supabase
        .from("skills_wanted")
        .select("skill_name")
        .eq("user_id", user.id);

      const myOffered = mySkillsOffered?.map(s => s.skill_name.toLowerCase()) || [];
      const myWanted = mySkillsWanted?.map(s => s.skill_name.toLowerCase()) || [];

      // Fetch all other profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .neq("user_id", user.id);

      if (!profiles) return;

      // Fetch all skills
      const { data: allSkillsOffered } = await supabase
        .from("skills_offered")
        .select("*");

      const { data: allSkillsWanted } = await supabase
        .from("skills_wanted")
        .select("*");

      // Fetch existing matches
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const matchedUserIds = new Set(
        matches?.map(m => m.user1_id === user.id ? m.user2_id : m.user1_id) || []
      );

      // Build potential matches
      const potentials: MatchedUser[] = [];
      const existing: MatchedUser[] = [];

      for (const profile of profiles) {
        const theirOffered = allSkillsOffered
          ?.filter(s => s.user_id === profile.user_id)
          .map(s => s.skill_name) || [];
        
        const theirWanted = allSkillsWanted
          ?.filter(s => s.user_id === profile.user_id)
          .map(s => s.skill_name) || [];

        // Check for skill matches
        const theyCanTeachMe = theirOffered.some(s => 
          myWanted.includes(s.toLowerCase())
        );
        const iCanTeachThem = myOffered.some(o => 
          theirWanted.some(w => w.toLowerCase().includes(o) || o.includes(w.toLowerCase()))
        );

        if (theyCanTeachMe || iCanTeachThem) {
          const match = matches?.find(m => 
            (m.user1_id === user.id && m.user2_id === profile.user_id) ||
            (m.user2_id === user.id && m.user1_id === profile.user_id)
          );

          const matchedUser: MatchedUser = {
            id: profile.id,
            user_id: profile.user_id,
            full_name: profile.full_name,
            bio: profile.bio,
            location: profile.location,
            skills_offered: theirOffered,
            skills_wanted: theirWanted,
            match_reason: match?.match_reason,
            matchId: match?.id,
            status: match?.status,
          };

          if (matchedUserIds.has(profile.user_id)) {
            existing.push(matchedUser);
          } else {
            potentials.push(matchedUser);
          }
        }
      }

      setPotentialMatches(potentials);
      setExistingMatches(existing);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [user]);

  const generateMatchReason = async (matchedUser: MatchedUser) => {
    if (!user) return;

    setGeneratingReasons(prev => new Set(prev).add(matchedUser.user_id));

    try {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { data: mySkillsOffered } = await supabase
        .from("skills_offered")
        .select("skill_name")
        .eq("user_id", user.id);

      const { data: mySkillsWanted } = await supabase
        .from("skills_wanted")
        .select("skill_name")
        .eq("user_id", user.id);

      const response = await supabase.functions.invoke("generate-match-reason", {
        body: {
          user1: {
            name: myProfile?.full_name,
            skillsOffered: mySkillsOffered?.map(s => s.skill_name) || [],
            skillsWanted: mySkillsWanted?.map(s => s.skill_name) || [],
          },
          user2: {
            name: matchedUser.full_name,
            skillsOffered: matchedUser.skills_offered,
            skillsWanted: matchedUser.skills_wanted,
          },
        },
      });

      if (response.error) throw response.error;

      const reason = response.data.reason;

      // Update the UI
      setPotentialMatches(prev => 
        prev.map(m => m.user_id === matchedUser.user_id ? { ...m, match_reason: reason } : m)
      );
      setExistingMatches(prev => 
        prev.map(m => m.user_id === matchedUser.user_id ? { ...m, match_reason: reason } : m)
      );

    } catch (error) {
      console.error("Error generating match reason:", error);
      toast({
        title: "Error",
        description: "Failed to generate match explanation.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReasons(prev => {
        const next = new Set(prev);
        next.delete(matchedUser.user_id);
        return next;
      });
    }
  };

  const connectWithUser = async (matchedUser: MatchedUser) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("matches")
        .insert({
          user1_id: user.id,
          user2_id: matchedUser.user_id,
          match_reason: matchedUser.match_reason,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Connection request sent!",
        description: `You've requested to connect with ${matchedUser.full_name}.`,
      });

      // Move to existing matches
      setPotentialMatches(prev => prev.filter(m => m.user_id !== matchedUser.user_id));
      setExistingMatches(prev => [...prev, { ...matchedUser, matchId: data.id, status: "pending" }]);

    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Error",
        description: "Failed to send connection request.",
        variant: "destructive",
      });
    }
  };

  const acceptMatch = async (matchedUser: MatchedUser) => {
    if (!matchedUser.matchId) return;

    try {
      await supabase
        .from("matches")
        .update({ status: "accepted" })
        .eq("id", matchedUser.matchId);

      setExistingMatches(prev =>
        prev.map(m => m.matchId === matchedUser.matchId ? { ...m, status: "accepted" } : m)
      );

      toast({
        title: "Match accepted!",
        description: `You can now chat with ${matchedUser.full_name}.`,
      });
    } catch (error) {
      console.error("Error accepting match:", error);
    }
  };

  const startChat = (matchedUser: MatchedUser) => {
    navigate(`/chat?match=${matchedUser.matchId}`);
  };

  const MatchCard = ({ matchedUser, type }: { matchedUser: MatchedUser; type: "potential" | "existing" }) => (
    <Card variant="match" className="overflow-hidden">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-foreground">{matchedUser.full_name}</h3>
            {matchedUser.location && (
              <p className="text-sm text-muted-foreground">{matchedUser.location}</p>
            )}
          </div>
          {matchedUser.status === "accepted" && (
            <Badge variant="skill">Connected</Badge>
          )}
          {matchedUser.status === "pending" && (
            <Badge variant="outline">Pending</Badge>
          )}
        </div>

        {matchedUser.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{matchedUser.bio}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Can teach:</span>
            <div className="flex flex-wrap gap-1">
              {matchedUser.skills_offered.slice(0, 3).map(skill => (
                <Badge key={skill} variant="skill" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {matchedUser.skills_offered.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{matchedUser.skills_offered.length - 3}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Wants:</span>
            <div className="flex flex-wrap gap-1">
              {matchedUser.skills_wanted.slice(0, 3).map(skill => (
                <Badge key={skill} variant="wanted" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {matchedUser.skills_wanted.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{matchedUser.skills_wanted.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {matchedUser.match_reason && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">{matchedUser.match_reason}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!matchedUser.match_reason && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateMatchReason(matchedUser)}
              disabled={generatingReasons.has(matchedUser.user_id)}
            >
              {generatingReasons.has(matchedUser.user_id) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Why match?
                </>
              )}
            </Button>
          )}

          {type === "potential" && (
            <Button 
              variant="hero" 
              size="sm"
              onClick={() => connectWithUser(matchedUser)}
            >
              <UserPlus className="w-4 h-4" />
              Connect
            </Button>
          )}

          {type === "existing" && matchedUser.status === "accepted" && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => startChat(matchedUser)}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </Button>
          )}

          {type === "existing" && matchedUser.status === "pending" && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => acceptMatch(matchedUser)}
            >
              Accept
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Find Matches</h1>
            <p className="text-muted-foreground">
              Discover people with complementary skills
            </p>
          </div>
          <Button variant="outline" onClick={fetchMatches}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Existing Matches */}
        {existingMatches.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Your Connections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingMatches.map(match => (
                <MatchCard key={match.user_id} matchedUser={match} type="existing" />
              ))}
            </div>
          </div>
        )}

        {/* Potential Matches */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Suggested Matches
            {potentialMatches.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({potentialMatches.length} found)
              </span>
            )}
          </h2>

          {potentialMatches.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No matches yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Add more skills to your profile to find people with complementary skills.
                </p>
                <Button variant="outline" onClick={() => navigate("/profile")}>
                  Update Profile
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {potentialMatches.map(match => (
                <MatchCard key={match.user_id} matchedUser={match} type="potential" />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
