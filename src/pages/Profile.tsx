import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  MapPin, 
  BookOpen, 
  GraduationCap, 
  X, 
  Plus,
  Save,
  Loader2
} from "lucide-react";

interface Profile {
  full_name: string;
  bio: string;
  location: string;
}

interface Skill {
  id: string;
  skill_name: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    bio: "",
    location: "",
  });
  const [skillsOffered, setSkillsOffered] = useState<Skill[]>([]);
  const [skillsWanted, setSkillsWanted] = useState<Skill[]>([]);
  const [newSkillOffered, setNewSkillOffered] = useState("");
  const [newSkillWanted, setNewSkillWanted] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          setProfile({
            full_name: profileData.full_name || "",
            bio: profileData.bio || "",
            location: profileData.location || "",
          });
        }

        // Fetch skills offered
        const { data: offeredData } = await supabase
          .from("skills_offered")
          .select("*")
          .eq("user_id", user.id);

        if (offeredData) {
          setSkillsOffered(offeredData);
        }

        // Fetch skills wanted
        const { data: wantedData } = await supabase
          .from("skills_wanted")
          .select("*")
          .eq("user_id", user.id);

        if (wantedData) {
          setSkillsWanted(wantedData);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          bio: profile.bio,
          location: profile.location,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addSkillOffered = async () => {
    if (!user || !newSkillOffered.trim()) return;

    try {
      const { data, error } = await supabase
        .from("skills_offered")
        .insert({ user_id: user.id, skill_name: newSkillOffered.trim() })
        .select()
        .single();

      if (error) throw error;

      setSkillsOffered([...skillsOffered, data]);
      setNewSkillOffered("");
      toast({ title: "Skill added!", description: `"${newSkillOffered}" has been added to your teachable skills.` });
    } catch (error) {
      console.error("Error adding skill:", error);
      toast({ title: "Error", description: "Failed to add skill.", variant: "destructive" });
    }
  };

  const addSkillWanted = async () => {
    if (!user || !newSkillWanted.trim()) return;

    try {
      const { data, error } = await supabase
        .from("skills_wanted")
        .insert({ user_id: user.id, skill_name: newSkillWanted.trim() })
        .select()
        .single();

      if (error) throw error;

      setSkillsWanted([...skillsWanted, data]);
      setNewSkillWanted("");
      toast({ title: "Skill added!", description: `"${newSkillWanted}" has been added to your wanted skills.` });
    } catch (error) {
      console.error("Error adding skill:", error);
      toast({ title: "Error", description: "Failed to add skill.", variant: "destructive" });
    }
  };

  const removeSkillOffered = async (id: string) => {
    try {
      await supabase.from("skills_offered").delete().eq("id", id);
      setSkillsOffered(skillsOffered.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error removing skill:", error);
    }
  };

  const removeSkillWanted = async (id: string) => {
    try {
      await supabase.from("skills_wanted").delete().eq("id", id);
      setSkillsWanted(skillsWanted.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error removing skill:", error);
    }
  };

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
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Your Profile</h1>
          <p className="text-muted-foreground">
            Manage your skills and personal information
          </p>
        </div>

        {/* Basic Info */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Your public profile details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location / Community</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    placeholder="e.g., MIT, San Francisco"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell others about yourself..."
                rows={3}
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Profile
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Skills I Can Teach */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Skills I Can Teach</CardTitle>
                <CardDescription>What you can help others learn</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {skillsOffered.map((skill) => (
                <Badge key={skill.id} variant="skill" className="gap-1 pr-1">
                  {skill.skill_name}
                  <button
                    onClick={() => removeSkillOffered(skill.id)}
                    className="ml-1 p-0.5 rounded hover:bg-primary/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {skillsOffered.length === 0 && (
                <p className="text-sm text-muted-foreground">No skills added yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkillOffered}
                onChange={(e) => setNewSkillOffered(e.target.value)}
                placeholder="e.g., Web Development, Photography"
                onKeyDown={(e) => e.key === "Enter" && addSkillOffered()}
              />
              <Button onClick={addSkillOffered} variant="outline">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Skills I Want to Learn */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle>Skills I Want to Learn</CardTitle>
                <CardDescription>What you'd like to learn from others</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {skillsWanted.map((skill) => (
                <Badge key={skill.id} variant="wanted" className="gap-1 pr-1">
                  {skill.skill_name}
                  <button
                    onClick={() => removeSkillWanted(skill.id)}
                    className="ml-1 p-0.5 rounded hover:bg-accent/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {skillsWanted.length === 0 && (
                <p className="text-sm text-muted-foreground">No skills added yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkillWanted}
                onChange={(e) => setNewSkillWanted(e.target.value)}
                placeholder="e.g., Guitar, Spanish, Machine Learning"
                onKeyDown={(e) => e.key === "Enter" && addSkillWanted()}
              />
              <Button onClick={addSkillWanted} variant="accent">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
