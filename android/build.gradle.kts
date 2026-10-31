// AGP 9 has Kotlin built in. Pinning the Kotlin Gradle plugin here keeps it on 2.4.20, the version
// in the local cache, so `./gradlew --offline` works. Do not apply org.jetbrains.kotlin.android.
buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath(libs.kotlin.gradle.plugin) }
}

plugins {
    alias(libs.plugins.android.application) apply false
}
