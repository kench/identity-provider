// The identity provider's Java code: Java 25, built with Gradle.
rootProject.name = "identity-provider-java"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}

// Checks Cognito access tokens for our APIs and MCP servers: an exact-match
// allowlist of issuers, keyed on `iss`.
include("verifier")
