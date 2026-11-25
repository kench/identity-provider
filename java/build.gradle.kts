// Shared settings for every subproject: Java 25, JUnit, JaCoCo with at least
// 90% line coverage, google-java-format through Spotless, and Checkstyle with
// Google's checks.

plugins {
    alias(libs.plugins.spotless) apply false
}

val catalog = extensions.getByType<VersionCatalogsExtension>().named("libs")

subprojects {
    apply(plugin = "java-library")
    apply(plugin = "jacoco")
    apply(plugin = "checkstyle")
    apply(plugin = "com.diffplug.spotless")

    extensions.configure<JavaPluginExtension> {
        toolchain {
            languageVersion = JavaLanguageVersion.of(25)
        }
    }

    // Byte-for-byte reproducible jars, so an unchanged build produces the same artifact.
    tasks.withType<AbstractArchiveTask>().configureEach {
        isPreserveFileTimestamps = false
        isReproducibleFileOrder = true
    }

    tasks.withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        options.release = 25
        options.compilerArgs.addAll(listOf("-Xlint:all", "-Xlint:-processing", "-Xlint:-serial"))
    }

    dependencies {
        "testImplementation"(platform(catalog.findLibrary("junit-bom").get()))
        "testImplementation"(catalog.findLibrary("junit-jupiter").get())
        "testRuntimeOnly"(catalog.findLibrary("junit-platform-launcher").get())
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
        finalizedBy("jacocoTestReport")
    }

    extensions.configure<JacocoPluginExtension> {
        toolVersion = catalog.findVersion("jacoco").get().requiredVersion
    }

    tasks.named<JacocoReport>("jacocoTestReport") {
        reports {
            xml.required = true
            html.required = true
        }
    }

    // At least 90% line coverage. Generated code (Dagger) is
    // excluded in the subprojects that have it.
    val coverage = tasks.register<JacocoCoverageVerification>("jacocoCoverage") {
        val report = tasks.named<JacocoReport>("jacocoTestReport").get()
        executionData.setFrom(report.executionData)
        sourceDirectories.setFrom(report.sourceDirectories)
        classDirectories.setFrom(report.classDirectories)
        violationRules {
            rule {
                limit {
                    counter = "LINE"
                    minimum = "0.90".toBigDecimal()
                }
            }
        }
        dependsOn("jacocoTestReport")
    }
    tasks.named("check") { dependsOn(coverage) }

    extensions.configure<CheckstyleExtension> {
        val version = catalog.findVersion("checkstyle").get().requiredVersion
        toolVersion = version
        // google_checks.xml ships inside the Checkstyle jar.
        config = resources.text.fromArchiveEntry(
            configurations.getByName("checkstyle").filter { it.name == "checkstyle-$version.jar" },
            "google_checks.xml",
        )
        maxWarnings = 0
    }

    extensions.configure<com.diffplug.gradle.spotless.SpotlessExtension> {
        java {
            target("src/**/*.java")
            googleJavaFormat(catalog.findVersion("google-java-format").get().requiredVersion)
        }
    }
}
