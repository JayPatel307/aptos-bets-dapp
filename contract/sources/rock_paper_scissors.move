module rock_paper_scissors::game {
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use std::hash;
    use std::string::{Self, String};
    use aptos_framework::object;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::table::{Self, Table};

    /// Game not found
    const E_GAME_NOT_FOUND: u64 = 1;
    /// Player already in game
    const E_PLAYER_ALREADY_IN_GAME: u64 = 2;
    /// Game is full
    const E_GAME_FULL: u64 = 3;
    /// Invalid move
    const E_INVALID_MOVE: u64 = 4;
    /// Not your turn
    const E_NOT_YOUR_TURN: u64 = 5;
    /// Game not in correct phase
    const E_WRONG_PHASE: u64 = 6;
    /// Move already committed
    const E_MOVE_ALREADY_COMMITTED: u64 = 7;
    /// Move not committed yet
    const E_MOVE_NOT_COMMITTED: u64 = 8;
    /// Invalid move reveal
    const E_INVALID_MOVE_REVEAL: u64 = 9;
    /// Not a player in this game
    const E_NOT_PLAYER: u64 = 10;
    /// Insufficient funds for bet
    const E_INSUFFICIENT_FUNDS: u64 = 11;
    /// Game ID already exists
    const E_GAME_ID_EXISTS: u64 = 12;
    /// Invalid bet amount
    const E_INVALID_BET_AMOUNT: u64 = 13;
    /// Game not finished
    const E_GAME_NOT_FINISHED: u64 = 14;
    /// Already withdrawn
    const E_ALREADY_WITHDRAWN: u64 = 15;
    /// Not the creator of the game
    const E_NOT_CREATOR: u64 = 16;
    /// Game already started (cannot cancel)
    const E_GAME_ALREADY_STARTED: u64 = 17;

    // Move types
    const ROCK: u8 = 0;
    const PAPER: u8 = 1;
    const SCISSORS: u8 = 2;

    // Game phases
    const PHASE_WAITING: u8 = 0;
    const PHASE_COMMIT: u8 = 1;
    const PHASE_REVEAL: u8 = 2;
    const PHASE_FINISHED: u8 = 3;

    // Game result types
    const RESULT_PENDING: u8 = 0;
    const RESULT_PLAYER1_WINS: u8 = 1;
    const RESULT_PLAYER2_WINS: u8 = 2;
    const RESULT_DRAW: u8 = 3;

    // Game types
    const GAME_TYPE_PUBLIC: u8 = 0;
    const GAME_TYPE_PRIVATE: u8 = 1;

    struct Game has key {
        creator: address,
        player1: Option<address>,
        player2: Option<address>,
        phase: u8,
        player1_move_hash: Option<vector<u8>>,
        player2_move_hash: Option<vector<u8>>,
        player1_move: Option<u8>,
        player2_move: Option<u8>,
        result: u8,
        winner: Option<address>,
        created_at: u64,
        game_type: u8,
        short_id: String,
        bet_amount: u64, // Amount in Octas (1 APT = 100,000,000 Octas)
        player1_deposit: Coin<AptosCoin>,
        player2_deposit: Coin<AptosCoin>,
        prize_withdrawn: bool,
    }

    struct GameRegistry has key {
        id_to_address: Table<String, address>,
        next_counter: u64,
        public_games: vector<String>,
    }

    #[event]
    struct GameCreated has drop, store {
        game_id: String,
        game_address: address,
        creator: address,
        game_type: u8,
        bet_amount: u64,
    }

    #[event]
    struct PlayerJoined has drop, store {
        game_id: String,
        player: address,
        deposit_amount: u64,
    }

    #[event]
    struct MoveCommitted has drop, store {
        game_id: String,
        player: address,
    }

    #[event]
    struct MoveRevealed has drop, store {
        game_id: String,
        player: address,
        player_move: u8,
    }

    #[event]
    struct GameFinished has drop, store {
        game_id: String,
        winner: Option<address>,
        result: u8,
        player1_move: u8,
        player2_move: u8,
        prize_amount: u64,
    }

    #[event]
    struct PrizeWithdrawn has drop, store {
        game_id: String,
        winner: address,
        amount: u64,
    }

    #[event]
    struct GameCancelled has drop, store {
        game_id: String,
        creator: address,
        refund_amount: u64,
    }

    /// Initialize the game registry (call once)
    public entry fun init_registry(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<GameRegistry>(account_addr)) {
            let registry = GameRegistry {
                id_to_address: table::new(),
                next_counter: 1,
                public_games: vector::empty(),
            };
            move_to(account, registry);
        };
    }

    /// Generate a short game ID (6 characters)
    fun generate_game_id(counter: u64, creator: address): String {
        let creator_bytes = std::bcs::to_bytes(&creator);
        let counter_bytes = std::bcs::to_bytes(&counter);
        let timestamp_bytes = std::bcs::to_bytes(&timestamp::now_microseconds());
        
        // Combine all bytes
        vector::append(&mut creator_bytes, counter_bytes);
        vector::append(&mut creator_bytes, timestamp_bytes);
        
        // Hash to get random bytes
        let hash_bytes = hash::sha3_256(creator_bytes);
        
        // Take first 4 bytes and convert to alphanumeric
        let id_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 4) {
            let byte = *vector::borrow(&hash_bytes, i);
            // Convert to alphanumeric: A-Z, 2-9 (exclude 0, O, 1, I for clarity)
            let char_val = (byte % 32) as u8;
            if (char_val < 26) {
                // Letters A-Z
                vector::push_back(&mut id_bytes, 65 + char_val);
            } else {
                // Numbers 2-9 (6 options: 2,3,4,5,6,7,8,9)
                vector::push_back(&mut id_bytes, 50 + (char_val - 26));
            };
            i = i + 1;
        };
        
        // Add counter suffix to ensure uniqueness
        let counter_suffix = (counter % 100) as u8;
        let tens = counter_suffix / 10;
        let ones = counter_suffix % 10;
        vector::push_back(&mut id_bytes, 48 + tens);
        vector::push_back(&mut id_bytes, 48 + ones);
        
        string::utf8(id_bytes)
    }

    /// Create a new game with bet amount
    public entry fun create_game(
        creator: &signer, 
        game_type: u8, 
        bet_amount: u64, // Amount in Octas
        registry_owner: address
    ) acquires GameRegistry {
        let creator_addr = signer::address_of(creator);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        assert!(bet_amount > 0, E_INVALID_BET_AMOUNT);
        
        // Check if player has enough balance
        let creator_balance = coin::balance<AptosCoin>(creator_addr);
        assert!(creator_balance >= bet_amount, E_INSUFFICIENT_FUNDS);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        let counter = registry.next_counter;
        registry.next_counter = counter + 1;
        
        // Generate short game ID
        let game_id = generate_game_id(counter, creator_addr);
        
        // Ensure ID is unique
        assert!(!table::contains(&registry.id_to_address, game_id), E_GAME_ID_EXISTS);
        
        // Withdraw bet amount from creator
        let creator_deposit = coin::withdraw<AptosCoin>(creator, bet_amount);
        
        // Create game object
        let constructor_ref = object::create_object(creator_addr);
        let game_signer = object::generate_signer(&constructor_ref);
        let game_address = signer::address_of(&game_signer);
        
        let game = Game {
            creator: creator_addr,
            player1: option::some(creator_addr),
            player2: option::none(),
            phase: PHASE_WAITING,
            player1_move_hash: option::none(),
            player2_move_hash: option::none(),
            player1_move: option::none(),
            player2_move: option::none(),
            result: RESULT_PENDING,
            winner: option::none(),
            created_at: timestamp::now_seconds(),
            game_type,
            short_id: game_id,
            bet_amount,
            player1_deposit: creator_deposit,
            player2_deposit: coin::zero<AptosCoin>(),
            prize_withdrawn: false,
        };
        
        move_to(&game_signer, game);
        
        // Register the game
        table::add(&mut registry.id_to_address, game_id, game_address);
        
        // Add to public games list if public
        if (game_type == GAME_TYPE_PUBLIC) {
            vector::push_back(&mut registry.public_games, game_id);
        };
        
        event::emit(GameCreated {
            game_id,
            game_address,
            creator: creator_addr,
            game_type,
            bet_amount,
        });
    }

    /// Join an existing game by short ID with bet
    public entry fun join_game(
        player: &signer, 
        game_id: String, 
        registry_owner: address
    ) acquires Game, GameRegistry {
        let player_addr = signer::address_of(player);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        
        let game = borrow_global_mut<Game>(game_address);
        assert!(game.phase == PHASE_WAITING, E_WRONG_PHASE);
        assert!(option::is_none(&game.player2), E_GAME_FULL);
        assert!(option::borrow(&game.player1) != &player_addr, E_PLAYER_ALREADY_IN_GAME);
        
        // Check if player has enough balance for the bet
        let player_balance = coin::balance<AptosCoin>(player_addr);
        assert!(player_balance >= game.bet_amount, E_INSUFFICIENT_FUNDS);
        
        // Withdraw bet amount from joining player
        let player_deposit = coin::withdraw<AptosCoin>(player, game.bet_amount);
        coin::merge(&mut game.player2_deposit, player_deposit);
        
        game.player2 = option::some(player_addr);
        game.phase = PHASE_COMMIT;
        
        event::emit(PlayerJoined {
            game_id,
            player: player_addr,
            deposit_amount: game.bet_amount,
        });
    }

    /// Commit a move (hashed)
    public entry fun commit_move(
        player: &signer, 
        game_id: String, 
        move_hash: vector<u8>, 
        registry_owner: address
    ) acquires Game, GameRegistry {
        let player_addr = signer::address_of(player);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        
        let game = borrow_global_mut<Game>(game_address);
        assert!(game.phase == PHASE_COMMIT, E_WRONG_PHASE);
        
        let is_player1 = option::contains(&game.player1, &player_addr);
        let is_player2 = option::contains(&game.player2, &player_addr);
        assert!(is_player1 || is_player2, E_NOT_PLAYER);
        
        if (is_player1) {
            assert!(option::is_none(&game.player1_move_hash), E_MOVE_ALREADY_COMMITTED);
            game.player1_move_hash = option::some(move_hash);
        } else {
            assert!(option::is_none(&game.player2_move_hash), E_MOVE_ALREADY_COMMITTED);
            game.player2_move_hash = option::some(move_hash);
        };
        
        // Check if both players have committed
        if (option::is_some(&game.player1_move_hash) && option::is_some(&game.player2_move_hash)) {
            game.phase = PHASE_REVEAL;
        };
        
        event::emit(MoveCommitted {
            game_id,
            player: player_addr,
        });
    }

    /// Reveal a move
    public entry fun reveal_move(
        player: &signer, 
        game_id: String, 
        player_move: u8, 
        nonce: vector<u8>, 
        registry_owner: address
    ) acquires Game, GameRegistry {
        let player_addr = signer::address_of(player);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        
        let game = borrow_global_mut<Game>(game_address);
        assert!(game.phase == PHASE_REVEAL, E_WRONG_PHASE);
        assert!(player_move <= SCISSORS, E_INVALID_MOVE);
        
        let is_player1 = option::contains(&game.player1, &player_addr);
        let is_player2 = option::contains(&game.player2, &player_addr);
        assert!(is_player1 || is_player2, E_NOT_PLAYER);
        
        // Verify the commitment
        let commitment = vector::empty<u8>();
        vector::append(&mut commitment, std::bcs::to_bytes(&player_move));
        vector::append(&mut commitment, nonce);
        let computed_hash = hash::sha3_256(commitment);
        
        if (is_player1) {
            assert!(option::is_some(&game.player1_move_hash), E_MOVE_NOT_COMMITTED);
            let stored_hash = option::borrow(&game.player1_move_hash);
            assert!(&computed_hash == stored_hash, E_INVALID_MOVE_REVEAL);
            game.player1_move = option::some(player_move);
        } else {
            assert!(option::is_some(&game.player2_move_hash), E_MOVE_NOT_COMMITTED);
            let stored_hash = option::borrow(&game.player2_move_hash);
            assert!(&computed_hash == stored_hash, E_INVALID_MOVE_REVEAL);
            game.player2_move = option::some(player_move);
        };
        
        event::emit(MoveRevealed {
            game_id,
            player: player_addr,
            player_move,
        });
        
        // Check if both players have revealed
        if (option::is_some(&game.player1_move) && option::is_some(&game.player2_move)) {
            let move1 = *option::borrow(&game.player1_move);
            let move2 = *option::borrow(&game.player2_move);
            
            game.phase = PHASE_FINISHED;
            
            if (move1 == move2) {
                game.result = RESULT_DRAW;
                // In case of draw, both players get their money back
            } else if ((move1 == ROCK && move2 == SCISSORS) ||
                      (move1 == PAPER && move2 == ROCK) ||
                      (move1 == SCISSORS && move2 == PAPER)) {
                game.result = RESULT_PLAYER1_WINS;
                game.winner = game.player1;
            } else {
                game.result = RESULT_PLAYER2_WINS;
                game.winner = game.player2;
            };
            
            let total_prize = coin::value(&game.player1_deposit) + coin::value(&game.player2_deposit);
            
            event::emit(GameFinished {
                game_id,
                winner: game.winner,
                result: game.result,
                player1_move: move1,
                player2_move: move2,
                prize_amount: total_prize,
            });
        };
    }

    /// Withdraw prize after winning
    public entry fun withdraw_prize(
        winner: &signer,
        game_id: String,
        registry_owner: address
    ) acquires Game, GameRegistry {
        let winner_addr = signer::address_of(winner);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        
        let game = borrow_global_mut<Game>(game_address);
        assert!(game.phase == PHASE_FINISHED, E_GAME_NOT_FINISHED);
        assert!(!game.prize_withdrawn, E_ALREADY_WITHDRAWN);
        
        let total_amount = coin::value(&game.player1_deposit) + coin::value(&game.player2_deposit);
        
        if (game.result == RESULT_DRAW) {
            // Both players get their money back
            assert!(winner_addr == *option::borrow(&game.player1) || 
                   winner_addr == *option::borrow(&game.player2), E_NOT_PLAYER);
            
            if (winner_addr == *option::borrow(&game.player1)) {
                let refund = coin::extract_all(&mut game.player1_deposit);
                coin::deposit(winner_addr, refund);
            } else {
                let refund = coin::extract_all(&mut game.player2_deposit);
                coin::deposit(winner_addr, refund);
            };
        } else {
            // Winner takes all
            assert!(option::contains(&game.winner, &winner_addr), E_NOT_PLAYER);
            
            let prize1 = coin::extract_all(&mut game.player1_deposit);
            let prize2 = coin::extract_all(&mut game.player2_deposit);
            
            coin::merge(&mut prize1, prize2);
            coin::deposit(winner_addr, prize1);
            
            game.prize_withdrawn = true;
            
            event::emit(PrizeWithdrawn {
                game_id,
                winner: winner_addr,
                amount: total_amount,
            });
        };
    }

    // View functions
    #[view]
    public fun get_game_info(game_id: String, registry_owner: address): (
        address, Option<address>, Option<address>, u8, u8, Option<address>, u64, bool
    ) acquires Game, GameRegistry {
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        let game = borrow_global<Game>(game_address);
        (
            game.creator,
            game.player1,
            game.player2,
            game.phase,
            game.result,
            game.winner,
            game.bet_amount,
            game.prize_withdrawn
        )
    }

    #[view]
    public fun get_game_moves(game_id: String, registry_owner: address): (Option<u8>, Option<u8>) acquires Game, GameRegistry {
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        let game = borrow_global<Game>(game_address);
        (game.player1_move, game.player2_move)
    }

    /// Cancel a game that hasn't been joined yet and get your bet back
    public entry fun cancel_game(
        creator: &signer,
        game_id: String,
        registry_owner: address
    ) acquires Game, GameRegistry {
        let creator_addr = signer::address_of(creator);
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        
        let registry = borrow_global_mut<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        
        let game = borrow_global_mut<Game>(game_address);
        
        // Only creator can cancel
        assert!(game.creator == creator_addr, E_NOT_CREATOR);
        
        // Can only cancel if no one has joined (still in WAITING phase)
        assert!(game.phase == PHASE_WAITING, E_GAME_ALREADY_STARTED);
        assert!(option::is_none(&game.player2), E_GAME_ALREADY_STARTED);
        
        // Return the bet to creator
        let refund = coin::extract_all(&mut game.player1_deposit);
        coin::deposit(creator_addr, refund);
        
        // Remove from registry
        table::remove(&mut registry.id_to_address, game_id);
        
        // Remove from public games list if it was public
        if (game.game_type == GAME_TYPE_PUBLIC) {
            let (found, index) = vector::index_of(&registry.public_games, &game_id);
            if (found) {
                vector::remove(&mut registry.public_games, index);
            };
        };
        
        event::emit(GameCancelled {
            game_id,
            creator: creator_addr,
            refund_amount: game.bet_amount,
        });
    }

    #[view]
    public fun get_public_games(registry_owner: address): vector<String> acquires GameRegistry {
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        let registry = borrow_global<GameRegistry>(registry_owner);
        registry.public_games
    }

    #[view]
    public fun get_game_type(game_id: String, registry_owner: address): u8 acquires Game, GameRegistry {
        assert!(exists<GameRegistry>(registry_owner), E_GAME_NOT_FOUND);
        let registry = borrow_global<GameRegistry>(registry_owner);
        assert!(table::contains(&registry.id_to_address, game_id), E_GAME_NOT_FOUND);
        
        let game_address = *table::borrow(&registry.id_to_address, game_id);
        assert!(exists<Game>(game_address), E_GAME_NOT_FOUND);
        let game = borrow_global<Game>(game_address);
        game.game_type
    }

    #[view]
    public fun create_move_hash(player_move: u8, nonce: vector<u8>): vector<u8> {
        let data = vector::singleton(player_move);
        vector::append(&mut data, nonce);
        hash::sha3_256(data)
    }
} 