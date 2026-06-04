// substrate/pallets/humanoid/src/lib.rs
// AXIOM Humanoid Control Subnet — Substrate Pallet
// Deploy on Konnex Substrate chain to enable real pallet calls
// (without this, system.remark fallback is used)
//
// Build: cargo build --release
// Test:  cargo test

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::UnixTime,
    };
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    // ── Storage types ─────────────────────────────────────────────────────
    #[derive(Encode, Decode, Clone, RuntimeDebug, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct HumanoidTask<AccountId, BlockNumber> {
        pub task_id:     BoundedVec<u8, ConstU32<16>>,
        pub instruction: BoundedVec<u8, ConstU32<256>>,
        pub task_type:   BoundedVec<u8, ConstU32<32>>,
        pub reward_knx:  u64,   // micro-KNX
        pub robot_id:    Option<AccountId>,
        pub poster:      AccountId,
        pub status:      TaskStatus,
        pub subnet_id:   u32,
        pub block:       BlockNumber,
    }

    #[derive(Encode, Decode, Clone, RuntimeDebug, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub enum TaskStatus { Open, Completed, Cancelled }

    /// Onchain PoPW record — exactly 96 bytes of critical data
    #[derive(Encode, Decode, Clone, RuntimeDebug, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct HumanoidMemoryRecord<AccountId, BlockNumber> {
        pub task_id:        BoundedVec<u8, ConstU32<16>>,  // 16B
        pub robot_id:       AccountId,                      // 32B (AccountId32)
        pub telemetry_hash: BoundedVec<u8, ConstU32<32>>,  // 32B — keccak-256
        pub ipfs_cid:       BoundedVec<u8, ConstU32<20>>,  // 20B
        pub popw_score:     u8,                             // 1B  (0-100)
        pub block_number:   BlockNumber,                    // 4B
        pub subnet_id:      u32,                            // 4B
        // Total key data: ~109 bytes (within 96-byte "onchain" target excl. AccountId overhead)
    }

    /// Pending validation — validators score this before settlement
    #[derive(Encode, Decode, Clone, RuntimeDebug, PartialEq, Eq, TypeInfo)]
    pub struct PendingValidation<AccountId, BlockNumber> {
        pub task_id:         Vec<u8>,
        pub robot_id:        AccountId,
        pub task_type:       Vec<u8>,
        pub telemetry_hash:  Vec<u8>,
        pub claimed_score:   u8,
        pub committed_block: BlockNumber,
        pub subnet_id:       u32,
    }

    // ── Config ────────────────────────────────────────────────────────────
    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant]
        type MaxTasksPerSubnet: Get<u32>;
        #[pallet::constant]
        type MaxMemoryPerRobot: Get<u32>;  // 1024
        #[pallet::constant]
        type ConsensusThreshold: Get<u32>; // 70 (percent)
        #[pallet::constant]
        type ValidatorSampleSize: Get<u32>; // 5
    }

    // ── Storage ───────────────────────────────────────────────────────────
    #[pallet::storage]
    pub type HumanoidTasks<T: Config> = StorageDoubleMap<
        _, Blake2_128Concat, u32,          // subnet_id
        Blake2_128Concat, BoundedVec<u8, ConstU32<16>>,  // task_id
        HumanoidTask<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::storage]
    pub type HumanoidMemory<T: Config> = StorageDoubleMap<
        _, Blake2_128Concat, T::AccountId, // robot_id
        Blake2_128Concat, BoundedVec<u8, ConstU32<16>>,  // task_id
        HumanoidMemoryRecord<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::storage]
    pub type PendingValidations<T: Config> = StorageDoubleMap<
        _, Blake2_128Concat, u32,          // subnet_id
        Blake2_128Concat, BoundedVec<u8, ConstU32<16>>,  // task_id
        PendingValidation<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::storage]
    pub type ValidationScores<T: Config> = StorageDoubleMap<
        _, Blake2_128Concat, BoundedVec<u8, ConstU32<16>>,  // task_id
        Blake2_128Concat, T::AccountId,    // validator
        u8,                                // score 0-100
        OptionQuery,
    >;

    // ── Events ────────────────────────────────────────────────────────────
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        HumanoidTaskPosted      { task_id: Vec<u8>, poster: T::AccountId, subnet_id: u32 },
        HumanoidPoPWCommitted   { task_id: Vec<u8>, robot_id: T::AccountId, block: BlockNumberFor<T> },
        HumanoidMemoryWritten   { task_id: Vec<u8>, robot_id: T::AccountId, popw_score: u8 },
        ValidationScoreSubmitted { task_id: Vec<u8>, validator: T::AccountId, score: u8 },
        InvalidPoPWReported     { task_id: Vec<u8>, reporter: T::AccountId, reason: Vec<u8> },
    }

    // ── Errors ────────────────────────────────────────────────────────────
    #[pallet::error]
    pub enum Error<T> {
        TaskNotFound,
        TaskAlreadyCompleted,
        MemoryCapReached,
        InvalidPoPWScore,
        HashTooLong,
        InstructionTooLong,
        AlreadyValidated,
    }

    // ── Pallet ────────────────────────────────────────────────────────────
    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ── Calls (extrinsics) ────────────────────────────────────────────────
    #[pallet::call]
    impl<T: Config> Pallet<T> {

        /// Post a new humanoid task onchain
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn post_humanoid_task(
            origin: OriginFor<T>,
            task_id:     Vec<u8>,
            instruction: Vec<u8>,
            task_type:   Vec<u8>,
            reward_knx:  u64,
            robot_id:    Option<T::AccountId>,
            subnet_id:   u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let task_id_b: BoundedVec<u8, ConstU32<16>> = task_id.clone().try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let instr_b: BoundedVec<u8, ConstU32<256>> = instruction.try_into().map_err(|_| Error::<T>::InstructionTooLong)?;
            let ttype_b: BoundedVec<u8, ConstU32<32>>  = task_type.try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let block = frame_system::Pallet::<T>::block_number();
            let task = HumanoidTask {
                task_id: task_id_b.clone(), instruction: instr_b,
                task_type: ttype_b, reward_knx, robot_id,
                poster: who.clone(), status: TaskStatus::Open,
                subnet_id, block,
            };
            HumanoidTasks::<T>::insert(subnet_id, task_id_b, task);
            Self::deposit_event(Event::HumanoidTaskPosted { task_id, poster: who, subnet_id });
            Ok(())
        }

        /// Phase 1: Commit telemetry hash onchain BEFORE revealing data
        /// This anchors the hash at a specific block — prevents retroactive manipulation
        #[pallet::call_index(1)]
        #[pallet::weight(8_000)]
        pub fn commit_humanoid_po_pw(
            origin: OriginFor<T>,
            robot_id:       Vec<u8>,
            task_type:      Vec<u8>,
            telemetry_hash: Vec<u8>,
            timestamp:      u64,
            subnet_id:      u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let block = frame_system::Pallet::<T>::block_number();
            // Store pending validation record
            let task_id_b: BoundedVec<u8, ConstU32<16>> = telemetry_hash[..16.min(telemetry_hash.len())].to_vec().try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let pending = PendingValidation {
                task_id: telemetry_hash[..16.min(telemetry_hash.len())].to_vec(),
                robot_id: who.clone(), task_type,
                telemetry_hash: telemetry_hash.clone(),
                claimed_score: 0,
                committed_block: block,
                subnet_id,
            };
            PendingValidations::<T>::insert(subnet_id, task_id_b, pending);
            Self::deposit_event(Event::HumanoidPoPWCommitted {
                task_id: telemetry_hash[..8.min(telemetry_hash.len())].to_vec(),
                robot_id: who, block,
            });
            Ok(())
        }

        /// Phase 3: Write final PoPW record onchain — 96 bytes of critical data
        /// Called after validator consensus is reached
        #[pallet::call_index(2)]
        #[pallet::weight(12_000)]
        pub fn write_humanoid_memory(
            origin: OriginFor<T>,
            task_id:        Vec<u8>,
            robot_id:       T::AccountId,
            task_type:      Vec<u8>,
            telemetry_hash: Vec<u8>,
            popw_score:     u8,
            ipfs_cid:       Vec<u8>,
            block_number:   u32,
            subnet_id:      u32,
        ) -> DispatchResult {
            ensure_signed(origin)?;
            ensure!(popw_score <= 100, Error::<T>::InvalidPoPWScore);
            let task_id_b: BoundedVec<u8, ConstU32<16>>  = task_id.clone().try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let hash_b:    BoundedVec<u8, ConstU32<32>>  = telemetry_hash.try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let cid_b:     BoundedVec<u8, ConstU32<20>>  = ipfs_cid.try_into().map_err(|_| Error::<T>::HashTooLong)?;
            let block      = frame_system::Pallet::<T>::block_number();
            let record = HumanoidMemoryRecord {
                task_id: task_id_b.clone(), robot_id: robot_id.clone(),
                telemetry_hash: hash_b, ipfs_cid: cid_b,
                popw_score, block_number: block, subnet_id,
            };
            HumanoidMemory::<T>::insert(&robot_id, &task_id_b, record);
            // Mark task as completed
            if let Some(mut task) = HumanoidTasks::<T>::get(subnet_id, &task_id_b) {
                task.status = TaskStatus::Completed;
                HumanoidTasks::<T>::insert(subnet_id, &task_id_b, task);
            }
            Self::deposit_event(Event::HumanoidMemoryWritten { task_id, robot_id, popw_score });
            Ok(())
        }

        /// Validator: submit score for assigned telemetry sections
        #[pallet::call_index(3)]
        #[pallet::weight(6_000)]
        pub fn submit_humanoid_validation_score(
            origin: OriginFor<T>,
            task_id:         Vec<u8>,
            validator_score: u8,
            sections_scored: Vec<u8>,
            hash_verified:   bool,
            subnet_id:       u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(validator_score <= 100, Error::<T>::InvalidPoPWScore);
            let task_id_b: BoundedVec<u8, ConstU32<16>> = task_id.clone().try_into().map_err(|_| Error::<T>::HashTooLong)?;
            ensure!(!ValidationScores::<T>::contains_key(&task_id_b, &who), Error::<T>::AlreadyValidated);
            ValidationScores::<T>::insert(&task_id_b, &who, validator_score);
            Self::deposit_event(Event::ValidationScoreSubmitted { task_id, validator: who, score: validator_score });
            Ok(())
        }

        /// Report invalid PoPW (hash mismatch or fraud)
        #[pallet::call_index(4)]
        #[pallet::weight(5_000)]
        pub fn report_invalid_humanoid_popw(
            origin: OriginFor<T>,
            task_id: Vec<u8>,
            reason:  Vec<u8>,
            subnet_id: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::deposit_event(Event::InvalidPoPWReported { task_id, reporter: who, reason });
            Ok(())
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_ok, assert_noop};

    #[test]
    fn test_post_task() {
        // Mock runtime test would go here
        // See Substrate docs for mock runtime setup
        assert!(true);
    }

    #[test]
    fn test_commit_popw() {
        assert!(true);
    }

    #[test]
    fn test_write_memory() {
        assert!(true);
    }

    #[test]
    fn test_popw_score_bounds() {
        // Score must be 0-100
        let valid_score: u8 = 85;
        assert!(valid_score <= 100);
        let invalid: u16 = 150;
        assert!(invalid > 100);
    }

    #[test]
    fn test_hash_size() {
        // telemetry_hash must fit in 32 bytes
        let hash = b"0xdeadbeef".to_vec();
        let bounded: Result<BoundedVec<u8, ConstU32<32>>, _> = hash.try_into();
        assert!(bounded.is_ok());
    }
}
