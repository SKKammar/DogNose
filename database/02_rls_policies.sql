-- Enable Row Level Security
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nose_prints ENABLE ROW LEVEL SECURITY;

-- Policies for dogs table
-- Users can only select their own dogs
CREATE POLICY "Users can view their own dogs"
    ON dogs FOR SELECT
    USING (auth.uid() = owner_id);

-- Users can insert their own dogs
CREATE POLICY "Users can insert their own dogs"
    ON dogs FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Users can update their own dogs
CREATE POLICY "Users can update their own dogs"
    ON dogs FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own dogs
CREATE POLICY "Users can delete their own dogs"
    ON dogs FOR DELETE
    USING (auth.uid() = owner_id);


-- Policies for nose_prints table
-- Users can view nose_prints of their own dogs
CREATE POLICY "Users can view their dogs nose prints"
    ON nose_prints FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

-- Users can insert nose_prints for their own dogs
CREATE POLICY "Users can insert their dogs nose prints"
    ON nose_prints FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

-- Users can update nose_prints of their own dogs
CREATE POLICY "Users can update their dogs nose prints"
    ON nose_prints FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );

-- Users can delete nose_prints of their own dogs
CREATE POLICY "Users can delete their dogs nose prints"
    ON nose_prints FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM dogs
            WHERE dogs.id = nose_prints.dog_id
            AND dogs.owner_id = auth.uid()
        )
    );
