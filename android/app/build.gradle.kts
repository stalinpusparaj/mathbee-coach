import java.util.Properties
import javax.inject.Inject

plugins {
    alias(libs.plugins.android.application)
}

/** Upload key, kept out of git (android/keystore.properties). Without it the release build is unsigned. */
val keystoreProps = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

/** Version from ../package.json ("1.2.3"); `-Pmathbee.build=N` bumps the code for re-uploads of the same version. */
val webVersion: String = Regex("\"version\"\\s*:\\s*\"([0-9]+\\.[0-9]+\\.[0-9]+)\"")
    .find(rootProject.file("../package.json").readText())?.groupValues?.get(1) ?: "1.0.0"
val buildNumber: Int = (project.findProperty("mathbee.build") as String?)?.toIntOrNull()?.coerceIn(0, 99) ?: 0
val webVersionCode: Int = webVersion.split('.').map(String::toInt)
    .let { (major, minor, patch) -> major * 1_000_000 + minor * 10_000 + patch * 100 + buildNumber }

android {
    namespace = "com.stalinpusparaj.mathbee"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.stalinpusparaj.mathbee"   // permanent once uploaded to Play
        minSdk = 26
        targetSdk = 36
        versionCode = webVersionCode
        versionName = webVersion
    }
    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) create("upload") {
            storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
            storePassword = keystoreProps.getProperty("storePassword")
            keyAlias = keystoreProps.getProperty("keyAlias")
            keyPassword = keystoreProps.getProperty("keyPassword")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("upload")
        }
        debug {
            // installs beside the Play build with its own storage, so testing never touches a child's garden
            applicationIdSuffix = ".debug"
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources {
        noCompress += listOf("webp", "png", "jpg", "ogg", "mp3", "woff2")
    }
}

/**
 * Copies the Vite Android build (../dist-android, made by `npm run build:android`) into the APK
 * under assets/web/, which the WebView serves at https://appassets.androidplatform.net/web/.
 * A missing dist-android fails the build on purpose: the app must never ship without the game.
 */
abstract class CopyWebGame : DefaultTask() {
    @get:InputDirectory abstract val webDist: DirectoryProperty
    @get:OutputDirectory abstract val outputDir: DirectoryProperty
    @get:Inject abstract val fs: FileSystemOperations

    @TaskAction fun copy() {
        fs.sync {
            from(webDist) { exclude("**/.DS_Store", "sw.js") }
            into(outputDir.dir("web"))
        }
    }
}

val copyWebGame = tasks.register<CopyWebGame>("copyWebGame") {
    webDist.set(rootProject.layout.projectDirectory.dir("../dist-android"))
}

androidComponents {
    onVariants { variant -> variant.sources.assets?.addGeneratedSourceDirectory(copyWebGame, CopyWebGame::outputDir) }
}

/**
 * The bundled privacy policy still has the owner's placeholders ([DEVELOPER NAME], [CONTACT EMAIL],
 * [LAST UPDATED]). Release builds fail until they are filled in; debug builds only warn.
 * HTML comments are ignored, so the note at the top of the file may keep naming them.
 */
abstract class CheckPrivacyPolicy : DefaultTask() {
    @get:InputFiles @get:PathSensitive(PathSensitivity.RELATIVE) abstract val policies: ConfigurableFileCollection
    @get:Input abstract val failOnPlaceholders: Property<Boolean>

    @TaskAction fun check() {
        val placeholders = listOf("[DEVELOPER NAME]", "[CONTACT EMAIL]", "[LAST UPDATED]")
        val problems = policies.files.filter { it.isFile }.flatMap { file ->
            val text = file.readText().replace(Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL), "")
            placeholders.filter { it in text }.map { "${file.path} still contains $it" }
        }
        if (problems.isEmpty()) return
        val msg = "Privacy policy placeholders must be filled in before a release:\n  " + problems.joinToString("\n  ")
        if (failOnPlaceholders.get()) throw GradleException(msg) else logger.warn("warning: $msg")
    }
}

fun privacyCheck(name: String, fail: Boolean) = tasks.register<CheckPrivacyPolicy>(name) {
    val root = rootProject.layout.projectDirectory
    policies.from(root.file("../public/privacy.html"), root.file("../dist-android/privacy.html"))
    failOnPlaceholders.set(fail)
}
val checkPrivacyRelease = privacyCheck("checkPrivacyPolicyRelease", fail = true)
val checkPrivacyDebug = privacyCheck("checkPrivacyPolicyDebug", fail = false)
tasks.matching { it.name == "preReleaseBuild" }.configureEach { dependsOn(checkPrivacyRelease) }
tasks.matching { it.name == "preDebugBuild" }.configureEach { dependsOn(checkPrivacyDebug) }

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.activity.ktx)
    implementation(libs.webkit)
    implementation(libs.core.splashscreen)
    testImplementation(libs.junit)
}
