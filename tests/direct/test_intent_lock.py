import json

CONTRACT = "contracts/intent_lock.py"


def producer(vm, relation, duplicate_of=""):
    decision = json.dumps({"relation": relation, "duplicate_of": duplicate_of})
    vm.mock_llm("INTENTLOCK_PRODUCER", json.dumps(decision))


def comparator(vm, result):
    vm._gl_call_hook = lambda _vm, request: {"ok": result} if "ExecPromptTemplate" in request else None


def setup_workspace(vm, deploy, owner, agent):
    contract = deploy(CONTRACT)
    vm.sender = owner
    contract.create_workspace("travel-ops", "Travel operations")
    contract.set_agent("travel-ops", agent, True)
    return contract


def submit_first(contract, vm, agent):
    vm.sender = agent
    return contract.submit_intent(
        "travel-ops", "req-alpha", "airline booking",
        "Book a refundable flight to Paris this Friday",
        "Maximum total price USD 450; one passenger", "paris-friday", 900,
    )


def test_distinct_reservation_is_executor_bound_and_single_use(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    intent_id = submit_first(contract, direct_vm, direct_bob)
    intent = contract.get_intent(intent_id)
    assert intent["relation"] == "DISTINCT" and intent["status"] == "RESERVED"
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the bound executor"):
        contract.consume_intent(intent_id)
    direct_vm.sender = direct_bob
    contract.consume_intent(intent_id)
    assert contract.get_intent(intent_id)["status"] == "EXECUTED"
    with direct_vm.expect_revert("active lease"):
        contract.consume_intent(intent_id)


def test_paraphrase_duplicate_links_exact_original(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    original = submit_first(contract, direct_vm, direct_bob)
    producer(direct_vm, "DUPLICATE", original)
    blocked = contract.submit_intent(
        "travel-ops", "req-beta", "flight reservation",
        "Reserve a cancellable Paris ticket for Friday",
        "One traveler; do not exceed $450 all in", "paris-friday", 900,
    )
    direct_vm.clear_mocks()
    record = contract.get_intent(blocked)
    assert record["status"] == "BLOCKED_DUPLICATE"
    assert record["duplicate_of"] == original


def test_validator_rechecks_exact_duplicate_identity(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    original = submit_first(contract, direct_vm, direct_bob)
    producer(direct_vm, "DUPLICATE", original)
    contract.submit_intent("travel-ops", "req-beta", "airline booking", "Reserve the same refundable Paris flight Friday", "One passenger, USD 450 maximum", "paris-friday", 900)
    comparator(direct_vm, True)
    assert direct_vm.run_validator() is True
    direct_vm.clear_mocks()
    producer(direct_vm, "DISTINCT")
    comparator(direct_vm, False)
    assert direct_vm.run_validator() is False
    direct_vm._gl_call_hook = None
    direct_vm.clear_mocks()


def test_malformed_duplicate_id_fails_before_storage(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    submit_first(contract, direct_vm, direct_bob)
    producer(direct_vm, "DUPLICATE", "invented-intent")
    with direct_vm.expect_revert("exact candidate"):
        contract.submit_intent("travel-ops", "req-bad", "airline booking", "Book that same flight again please", "same passenger and cap", "paris-friday", 900)
    assert len(contract.list_intents("travel-ops")) == 1


def test_ambiguous_fails_safe_and_owner_can_recover(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    submit_first(contract, direct_vm, direct_bob)
    producer(direct_vm, "AMBIGUOUS")
    review_id = contract.submit_intent("travel-ops", "req-vague", "travel", "Arrange another Paris option", "Use the usual preferences", "paris-friday", 900)
    direct_vm.clear_mocks()
    assert contract.get_intent(review_id)["status"] == "REVIEW_REQUIRED"
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the workspace owner"):
        contract.resolve_review(review_id, "DISTINCT", "", 900)
    direct_vm.sender = direct_alice
    contract.resolve_review(review_id, "DISTINCT", "", 900)
    assert contract.get_intent(review_id)["status"] == "RESERVED"


def test_authorization_replay_cancellation_and_permissionless_expiry(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not an authorized"):
        contract.submit_intent("travel-ops", "req-x", "hotel", "Book a hotel room in Paris", "Under USD 200", "paris-friday", 60)
    first = submit_first(contract, direct_vm, direct_bob)
    with direct_vm.expect_revert("already been used"):
        submit_first(contract, direct_vm, direct_bob)
    direct_vm.warp("2030-01-01T00:00:00Z")
    import genlayer as gl
    gl.message.raw["datetime"] = "2030-01-01T00:00:00Z"
    direct_vm.sender = direct_charlie
    contract.expire_intent(first)
    assert contract.get_intent(first)["status"] == "EXPIRED"


def test_window_saturation_rejects_instead_of_skipping_candidates(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = setup_workspace(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    for index in range(8):
        if index:
            producer(direct_vm, "DISTINCT")
        contract.submit_intent("travel-ops", f"req-{index}", "merchant", f"Purchase distinct numbered item {index}", f"Quantity {index + 1}", "batch-window", 900)
        direct_vm.clear_mocks()
    with direct_vm.expect_revert("window is saturated"):
        contract.submit_intent("travel-ops", "req-nine", "merchant", "Purchase a ninth unrelated item", "Quantity nine", "batch-window", 900)
