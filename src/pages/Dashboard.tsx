import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  GraduationCap, 
  Users, 
  ArrowRight,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  skillsOffered: number;
  skillsWanted: number;
  activeMatches: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    skillsOffered: 0,
    skillsWanted: 0,
    activeMatches: 0,
  });
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();

        setProfile(profileData);

        // Fetch skills offered count
        const { count: offeredCount } = await supabase
          .from("skills_offered")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // Fetch skills wanted count
        const { count: wantedCount } = await supabase
          .from("skills_wanted")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // Fetch matches count
        const { count: matchesCount } = await supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .eq("status", "accepted");

        setStats({
          skillsOffered: offeredCount || 0,
          skillsWanted: wantedCount || 0,
          activeMatches: matchesCount || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const statCards = [
    {
      title: "Skills I Teach",
      value: stats.skillsOffered,
      icon: BookOpen,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Skills I Want",
      value: stats.skillsWanted,
      icon: GraduationCap,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Active Matches",
      value: stats.activeMatches,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-secondary",
    },
  ];

  const quickActions = [
    {
      title: "Find Matches",
      description: "Discover people with complementary skills",
      icon: Sparkles,
      href: "/matches",
      variant: "hero" as const,
    },
    {
      title: "Update Profile",
      description: "Add more skills to get better matches",
      icon: GraduationCap,
      href: "/profile",
      variant: "outline" as const,
    },
    {
      title: "View Messages",
      description: "Continue your conversations",
      icon: MessageSquare,
      href: "/chat",
      variant: "outline" as const,
    },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
            {loading ? (
              <span className="inline-block w-48 h-8 bg-muted rounded animate-pulse" />
            ) : (
              <>Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!</>
            )}
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's what's happening with your skill exchange journey.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} variant="elevated" className="hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">
                      {stat.title}
                    </p>
                    <p className="text-4xl font-bold text-foreground">
                      {loading ? (
                        <span className="inline-block w-12 h-10 bg-muted rounded animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Card key={action.title} variant="match" className="group">
                <Link to={action.href}>
                  <CardContent className="p-6 space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <action.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Go to {action.title.toLowerCase()}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        {stats.skillsOffered === 0 && stats.skillsWanted === 0 && !loading && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Let's get started!
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Add the skills you can teach and the ones you want to learn.
                We'll help you find the perfect skill swap partners!
              </p>
              <Button variant="hero" size="lg" asChild>
                <Link to="/profile">
                  Set Up Your Profile
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
