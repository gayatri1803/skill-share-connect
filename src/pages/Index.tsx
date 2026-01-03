import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Sparkles, BookOpen, MessageSquare } from "lucide-react";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Skill Swap</span>
          </div>
          <Button variant="outline" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </nav>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="max-w-3xl space-y-8 animate-fade-in">
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
              Exchange Skills,
              <span className="text-gradient-primary block">Build Connections</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl">
              Join a community where everyone teaches and everyone learns. Share your expertise, pick up new skills, and grow together.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "Share Your Skills", desc: "List the skills you can teach others" },
              { icon: Sparkles, title: "Smart Matching", desc: "AI finds your perfect skill swap partners" },
              { icon: MessageSquare, title: "Connect & Learn", desc: "Chat and exchange knowledge" },
            ].map((feature, i) => (
              <div key={i} className="bg-card rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 Skill Swap. Built with community in mind.
        </div>
      </footer>
    </div>
  );
}
