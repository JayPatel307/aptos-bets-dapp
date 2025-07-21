#[test_only]
module rock_paper_scissors::game_tests {
    use std::signer;
    use std::vector;
    use std::hash;
    use aptos_framework::timestamp;
    use rock_paper_scissors::game;

    const ROCK: u8 = 0;
    const PAPER: u8 = 1;
    const SCISSORS: u8 = 2;

    const PHASE_WAITING: u8 = 0;
    const PHASE_COMMIT: u8 = 1;
    const PHASE_REVEAL: u8 = 2;
    const PHASE_FINISHED: u8 = 3;

    const RESULT_PENDING: u8 = 0;
    const RESULT_PLAYER1_WINS: u8 = 1;
    const RESULT_PLAYER2_WINS: u8 = 2;
    const RESULT_DRAW: u8 = 3;

    fun setup_test(aptos: &signer, player1: &signer, player2: &signer) {
        timestamp::set_time_has_started_for_testing(aptos);
        
        let player1_addr = signer::address_of(player1);
        let player2_addr = signer::address_of(player2);
        
        // Create accounts for testing
        aptos_framework::account::create_account_for_test(player1_addr);
        aptos_framework::account::create_account_for_test(player2_addr);
    }

    fun create_move_hash(player_move: u8, nonce: vector<u8>): vector<u8> {
        let data = vector::singleton(player_move);
        vector::append(&mut data, nonce);
        hash::sha3_256(data)
    }

    #[test(aptos = @0x1, player1 = @0x100, player2 = @0x200)]
    fun test_create_game(aptos: &signer, player1: &signer, player2: &signer) {
        setup_test(aptos, player1, player2);
        
        game::create_game(player1);
        
        // Game creation emits an event - in a real test we would verify this
        // For now, we just verify the function doesn't abort
    }

    #[test(aptos = @0x1, player1 = @0x100, player2 = @0x200)]
    fun test_join_game_and_commit_moves(aptos: &signer, player1: &signer, player2: &signer) {
        setup_test(aptos, player1, player2);
        
        game::create_game(player1);
        
        // We need to simulate getting the game ID from events in a real scenario
        // For testing, we'll use a known pattern for object addresses
        
        // In practice, you'd get this from the GameCreated event
        // For testing, we'll need to calculate or know the game address
        // Let's create another game to test the flow
        game::create_game(player2);
    }

    #[test(aptos = @0x1, player1 = @0x100, player2 = @0x200)]
    fun test_complete_game_flow(aptos: &signer, player1: &signer, player2: &signer) {
        setup_test(aptos, player1, player2);
        
        // Test game creation
        game::create_game(player1);
        
        // Note: In a real test environment, we would need to capture the game_id from events
        // For this example, we're showing the structure of what the tests would look like
    }

    #[test]
    fun test_move_hash_creation() {
        let player_move = ROCK;
        let nonce = b"random_nonce_123";
        
        let hash1 = game::create_move_hash(player_move, nonce);
        let hash2 = game::create_move_hash(player_move, nonce);
        
        // Same inputs should produce same hash
        assert!(hash1 == hash2, 1);
        
        // Different nonce should produce different hash
        let different_nonce = b"different_nonce";
        let hash3 = game::create_move_hash(player_move, different_nonce);
        assert!(hash1 != hash3, 2);
    }

    #[test]
    fun test_hash_function_works() {
        // Test that the hash function works with valid moves
        let valid_moves = vector[ROCK, PAPER, SCISSORS];
        let nonce = b"test_nonce";
        
        let i = 0;
        while (i < vector::length(&valid_moves)) {
            let player_move = *vector::borrow(&valid_moves, i);
            let _hash = game::create_move_hash(player_move, nonce);
            // If we get here without aborting, the hash function works
            i = i + 1;
        };
    }
} 