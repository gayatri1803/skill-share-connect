-- Fix foreign key relationships for proper joins
-- Change skills_offered and skills_wanted to reference profiles.id instead of auth.users.id

-- First, add temporary columns
ALTER TABLE public.skills_offered ADD COLUMN temp_user_id UUID;
ALTER TABLE public.skills_wanted ADD COLUMN temp_user_id UUID;

-- Migrate data from user_id to temp_user_id (they reference the same auth.users)
UPDATE public.skills_offered SET temp_user_id = user_id;
UPDATE public.skills_wanted SET temp_user_id = user_id;

-- Drop old foreign key constraints
ALTER TABLE public.skills_offered DROP CONSTRAINT skills_offered_user_id_fkey;
ALTER TABLE public.skills_wanted DROP CONSTRAINT skills_wanted_user_id_fkey;

-- Update user_id to reference profiles.id instead of auth.users.id
-- First, we need to map auth.users.id to profiles.id
UPDATE public.skills_offered
SET user_id = profiles.id
FROM public.profiles
WHERE skills_offered.temp_user_id = profiles.user_id;

UPDATE public.skills_wanted
SET user_id = profiles.id
FROM public.profiles
WHERE skills_wanted.temp_user_id = profiles.user_id;

-- Drop temp columns
ALTER TABLE public.skills_offered DROP COLUMN temp_user_id;
ALTER TABLE public.skills_wanted DROP COLUMN temp_user_id;

-- Add new foreign key constraints referencing profiles.id
ALTER TABLE public.skills_offered
  ADD CONSTRAINT skills_offered_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.skills_wanted
  ADD CONSTRAINT skills_wanted_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update RLS policies to work with profiles.id reference
DROP POLICY "Users can manage own skills offered" ON public.skills_offered;
DROP POLICY "Users can manage own skills wanted" ON public.skills_wanted;

-- New policies using profiles.user_id for auth checks
CREATE POLICY "Users can manage own skills offered" ON public.skills_offered
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = skills_offered.user_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own skills wanted" ON public.skills_wanted
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = skills_wanted.user_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Also update matches table to reference profiles.id
ALTER TABLE public.matches ADD COLUMN temp_user1_id UUID;
ALTER TABLE public.matches ADD COLUMN temp_user2_id UUID;

UPDATE public.matches SET temp_user1_id = user1_id, temp_user2_id = user2_id;

ALTER TABLE public.matches DROP CONSTRAINT matches_user1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT matches_user2_id_fkey;

UPDATE public.matches
SET user1_id = p1.id
FROM public.profiles p1
WHERE matches.temp_user1_id = p1.user_id;

UPDATE public.matches
SET user2_id = p2.id
FROM public.profiles p2
WHERE matches.temp_user2_id = p2.user_id;

ALTER TABLE public.matches DROP COLUMN temp_user1_id;
ALTER TABLE public.matches DROP COLUMN temp_user2_id;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_user1_id_fkey
  FOREIGN KEY (user1_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_user2_id_fkey
  FOREIGN KEY (user2_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update matches policies
DROP POLICY "Users can view their matches" ON public.matches;
DROP POLICY "Users can create matches" ON public.matches;
DROP POLICY "Users can update their matches" ON public.matches;

CREATE POLICY "Users can view their matches" ON public.matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = matches.user1_id AND profiles.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = matches.user2_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Users can create matches" ON public.matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = matches.user1_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Users can update their matches" ON public.matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = matches.user1_id AND profiles.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = matches.user2_id AND profiles.user_id = auth.uid())
  );

-- Update messages table
ALTER TABLE public.messages ADD COLUMN temp_sender_id UUID;

UPDATE public.messages SET temp_sender_id = sender_id;

ALTER TABLE public.messages DROP CONSTRAINT messages_sender_id_fkey;

UPDATE public.messages
SET sender_id = profiles.id
FROM public.profiles
WHERE messages.temp_sender_id = profiles.user_id;

ALTER TABLE public.messages DROP COLUMN temp_sender_id;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update messages policies
DROP POLICY "Users can view messages in their matches" ON public.messages;
DROP POLICY "Users can send messages in their matches" ON public.messages;

CREATE POLICY "Users can view messages in their matches" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches
      JOIN public.profiles p1 ON matches.user1_id = p1.id
      JOIN public.profiles p2 ON matches.user2_id = p2.id
      WHERE matches.id = messages.match_id
      AND (p1.user_id = auth.uid() OR p2.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = messages.sender_id AND profiles.user_id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.matches
      JOIN public.profiles p1 ON matches.user1_id = p1.id
      JOIN public.profiles p2 ON matches.user2_id = p2.id
      WHERE matches.id = messages.match_id
      AND (p1.user_id = auth.uid() OR p2.user_id = auth.uid())
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_skills_offered_user_id ON public.skills_offered(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_wanted_user_id ON public.skills_wanted(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user1_id ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2_id ON public.matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);