package com.kubbonet.segundocerebro.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

val DarkBackground = Color(0xFF13131A)
val SurfaceDark = Color(0xFF191924)
val SurfaceCard = Color(0xFF1C1C28)
val BorderDark = Color(0xFF28283C)

val AccentBlue = Color(0xFF3B82F6)
val AccentPurple = Color(0xFFA855F7)
val AccentAmber = Color(0xFFF59E0B)
val AccentGreen = Color(0xFF10B981)
val AccentRose = Color(0xFFF43F5E)

val TextPrimary = Color(0xFFF3F4F6)
val TextSecondary = Color(0xFF9CA3AF)
val TextMuted = Color(0xFF6B7280)

val SegundoCerebroColorScheme = darkColorScheme(
    primary = AccentBlue,
    secondary = AccentPurple,
    tertiary = AccentAmber,
    background = DarkBackground,
    surface = SurfaceDark,
    surfaceVariant = SurfaceCard,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary
)
