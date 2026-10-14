"""Keelson relations between element kinds: (from kind, to kind, verb) - item 1340.

These are the relations the model expects. Concrete links between elements use the same verbs.
"""

_RELATIONS = [
    ("Goal", "Product", "belongs to"), ("Feature", "Goal", "contributes to"), ("Story", "Feature", "is part of"),
    ("RoadmapItem", "Feature", "falls under"), ("Story", "Persona", "is written for"), ("Decision", "Feature", "steers"),
    ("Decision", "ADR", "is detailed in"), ("Feedback", "RoadmapItem", "leads to"), ("Feedback", "User", "comes from"),
    ("Ticket", "Bug", "can become"), ("UsageMetric", "Goal", "measures"), ("Experiment", "FeatureFlag", "uses"),
    ("Experiment", "UsageMetric", "is measured with"),
    ("Screen", "Story", "realises"), ("DesignToken", "Screen", "styles"), ("Screen", "ApiEndpoint", "calls"),
    ("DomainEntity", "Table", "is stored in"), ("Component", "Service", "runs as"), ("ADR", "Component", "shapes"),
    ("ApiEndpoint", "Component", "is served by"),
    ("Commit", "Story", "implements"), ("Commit", "Branch", "lands on"), ("Branch", "Repository", "belongs to"),
    ("PullRequest", "Branch", "merges into"), ("Dependency", "Repository", "is used in"), ("TechDebt", "Component", "sits in"),
    ("TestCase", "Story", "verifies"), ("TestRun", "TestCase", "executes"), ("TestRun", "Build", "validates"),
    ("AcceptanceCheck", "Deployment", "approves"), ("Bug", "RoadmapItem", "lands as"), ("QualityMetric", "Commit", "is measured on"),
    ("Pipeline", "Repository", "runs for"), ("Build", "Commit", "builds"), ("Build", "Pipeline", "is a run of"),
    ("Artifact", "Build", "is produced by"), ("Release", "Artifact", "bundles"), ("Release", "Version", "carries"),
    ("ChangelogEntry", "Release", "describes"), ("ChangelogEntry", "RoadmapItem", "comes from"),
    ("Deployment", "Artifact", "rolls out"), ("Deployment", "Environment", "targets"), ("FeatureFlag", "Feature", "switches"),
    ("Environment", "Host", "runs on"), ("Service", "Environment", "is part of"), ("ConfigVar", "Service", "configures"),
    ("Secret", "Service", "is used by"), ("Database", "Environment", "belongs to"), ("Database", "Table", "contains"),
    ("Backup", "Database", "protects"), ("Domain", "Service", "routes to"), ("Capacity", "Host", "is measured on"),
    ("ErrorEvent", "Release", "occurs in"), ("ErrorEvent", "Environment", "is reported from"), ("ErrorEvent", "Bug", "becomes"),
    ("HealthCheck", "Service", "watches"), ("LogStream", "Service", "comes from"), ("Metric", "Host", "is measured on"),
    ("Alert", "Metric", "fires on"), ("Alert", "HealthCheck", "follows"), ("Incident", "Alert", "starts with"),
    ("Incident", "Bug", "produces"), ("Runbook", "Incident", "resolves"), ("Runbook", "Playbook", "is captured as"),
    ("Role", "User", "is granted to"), ("ApiKey", "Role", "has"), ("Vulnerability", "Dependency", "sits in"),
    ("Vulnerability", "Artifact", "is found in"), ("AuditEntry", "User", "records actions of"), ("DataRecord", "Table", "describes"),
    ("AccessGrant", "Host", "grants access to"),
    ("Member", "Product", "works on"), ("Member", "JobRole", "fills"), ("Agent", "JobRole", "fills"),
    ("JobRole", "Product", "is responsible for"), ("JobRole", "Competence", "requires"), ("Member", "Competence", "has"),
    ("Availability", "Member", "belongs to"), ("Onboarding", "Member", "is for"), ("Onboarding", "AccessGrant", "arranges"),
    ("Onboarding", "Role", "assigns"), ("Contract", "Member", "is with"), ("Contract", "CostItem", "leads to"),
    ("Development", "Competence", "builds"), ("Availability", "Incident", "decides who responds to"),
    ("Agent", "Session", "runs"), ("Session", "RoadmapItem", "works on"), ("Guardrail", "Agent", "steers"),
    ("Playbook", "Guardrail", "puts into practice"), ("Doc", "ADR", "contains"),
    ("Estimate", "RoadmapItem", "sizes"), ("TimeEntry", "Session", "is measured from"), ("TimeEntry", "Member", "belongs to"),
    ("CostItem", "Host", "is the cost of"), ("Subscription", "Pipeline", "pays for"), ("Budget", "Product", "funds"),
    ("BusinessCase", "Feature", "justifies"), ("BusinessCase", "Goal", "contributes to"), ("Estimate", "BusinessCase", "feeds"),
    ("CostItem", "Budget", "is charged to"), ("Subscription", "Budget", "is charged to"), ("Invoice", "Subscription", "bills"),
    ("Invoice", "Contract", "follows"), ("Revenue", "Product", "comes from"), ("Revenue", "Invoice", "is billed through"),
    ("Asset", "Host", "is the hardware of"), ("Asset", "Budget", "is depreciated on"),
]

RELATIONS = [{"from": a, "to": b, "verb": v} for a, b, v in _RELATIONS]
