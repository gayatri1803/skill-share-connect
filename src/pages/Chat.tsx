import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Loader2, 
  MessageSquare,
  ArrowLeft,
  User
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  match_reason: string;
  otherUser?: {
    full_name: string;
    location: string;
  };
}

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedMatchId = searchParams.get("match");

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!user) return;

      try {
        const { data: matchesData } = await supabase
          .from("matches")
          .select("*")
          .eq("status", "accepted")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (!matchesData) return;

        // Fetch other users' profiles
        const otherUserIds = matchesData.map(m => 
          m.user1_id === user.id ? m.user2_id : m.user1_id
        );

        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", otherUserIds);

        const enrichedMatches = matchesData.map(match => ({
          ...match,
          otherUser: profiles?.find(p => 
            p.user_id === (match.user1_id === user.id ? match.user2_id : match.user1_id)
          ),
        }));

        setMatches(enrichedMatches);

        // Auto-select match from URL
        if (selectedMatchId) {
          const match = enrichedMatches.find(m => m.id === selectedMatchId);
          if (match) setSelectedMatch(match);
        }
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", selectedMatch.id)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${selectedMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${selectedMatch.id}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch]);

  const sendMessage = async () => {
    if (!user || !selectedMatch || !newMessage.trim()) return;

    setSending(true);
    try {
      await supabase.from("messages").insert({
        match_id: selectedMatch.id,
        sender_id: user.id,
        content: newMessage.trim(),
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const selectMatch = (match: Match) => {
    setSelectedMatch(match);
    navigate(`/chat?match=${match.id}`, { replace: true });
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
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Messages</h1>
            <p className="text-muted-foreground">Chat with your skill swap partners</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Conversations List */}
          <Card variant="elevated" className="lg:col-span-1 overflow-hidden">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100%-60px)]">
              {matches.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No conversations yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => navigate("/matches")}
                  >
                    Find Matches
                  </Button>
                </div>
              ) : (
                <div className="p-2">
                  {matches.map(match => (
                    <button
                      key={match.id}
                      onClick={() => selectMatch(match)}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                        selectedMatch?.id === match.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedMatch?.id === match.id
                            ? "bg-primary-foreground/20"
                            : "bg-primary/10"
                        }`}>
                          <User className={`w-5 h-5 ${
                            selectedMatch?.id === match.id
                              ? "text-primary-foreground"
                              : "text-primary"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {match.otherUser?.full_name || "User"}
                          </p>
                          {match.otherUser?.location && (
                            <p className={`text-xs truncate ${
                              selectedMatch?.id === match.id
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}>
                              {match.otherUser.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Chat Area */}
          <Card variant="chat" className="lg:col-span-2 flex flex-col overflow-hidden">
            {selectedMatch ? (
              <>
                <CardHeader className="border-b border-border py-4 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="lg:hidden"
                      onClick={() => setSelectedMatch(null)}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {selectedMatch.otherUser?.full_name || "User"}
                      </CardTitle>
                      {selectedMatch.otherUser?.location && (
                        <p className="text-sm text-muted-foreground">
                          {selectedMatch.otherUser.location}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No messages yet</p>
                        <p className="text-sm text-muted-foreground">Say hello to start the conversation!</p>
                      </div>
                    ) : (
                      messages.map(message => {
                        const isOwn = message.sender_id === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted text-foreground rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                                {format(new Date(message.created_at), "HH:mm")}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border flex-shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      disabled={sending}
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Select a conversation</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose from your matches to start chatting
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
