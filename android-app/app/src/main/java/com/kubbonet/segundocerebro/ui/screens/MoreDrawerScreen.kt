package com.kubbonet.segundocerebro.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kubbonet.segundocerebro.ui.theme.*
import com.kubbonet.segundocerebro.viewmodel.AuthState
import com.kubbonet.segundocerebro.viewmodel.MainViewModel

@Composable
fun MoreDrawerScreen(
    viewModel: MainViewModel,
    onOpenAuthModal: () -> Unit,
    onNavigateToProjects: () -> Unit,
    onNavigateToHabits: () -> Unit
) {
    val authState by viewModel.authState.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 96.dp)
    ) {
        // Encabezado de Perfil / Estado de Cuenta
        item {
            Surface(
                color = SurfaceDark,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (authState !is AuthState.Authenticated) {
                            onOpenAuthModal()
                        }
                    }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(AccentPurple.copy(alpha = 0.2f), shape = RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = AccentPurple
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        when (val state = authState) {
                            is AuthState.Authenticated -> {
                                Text(
                                    text = state.user.name ?: state.user.email.substringBefore("@"),
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = state.user.email,
                                    color = TextMuted,
                                    fontSize = 12.sp
                                )
                            }
                            else -> {
                                Text(
                                    text = "Iniciar Sesión / Registrarse",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Sincroniza con InsForge Cloud o Local",
                                    color = AccentBlue,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }

                    if (authState is AuthState.Authenticated) {
                        IconButton(onClick = { viewModel.logout() }) {
                            Icon(Icons.Default.ExitToApp, contentDescription = "Cerrar sesión", tint = AccentRose)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
        }

        // Módulos Principales (PARA Method)
        item {
            Text(
                text = "Módulos de Segundo Cerebro",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        item {
            MoreNavigationItem(icon = Icons.Default.Folder, title = "Proyectos", subtitle = "Resultados con fecha límite", color = AccentBlue) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.Layers, title = "Áreas de Responsabilidad", subtitle = "Mantenimiento continuo", color = AccentPurple) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.Inbox, title = "Bandeja de Entrada (Inbox)", subtitle = "Captura y clasificación rápida", color = AccentAmber) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.Bookmark, title = "Recursos & Conocimiento", subtitle = "Material de consulta", color = AccentGreen) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.Archive, title = "Archivo Histórico", subtitle = "Elementos completados o inactivos", color = TextMuted) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.Timeline, title = "Hábitos & Rutinas", subtitle = "Auditoría diaria y constancia", color = Color(0xFF06B6D4)) {
                onNavigateToHabits()
            }
            MoreNavigationItem(icon = Icons.Default.Group, title = "Objetos & Personas", subtitle = "CRM y base relacional", color = AccentRose) {
                onNavigateToProjects()
            }
            MoreNavigationItem(icon = Icons.Default.CloudQueue, title = "Archivos (R2 / Storage)", subtitle = "Adjuntos e imágenes", color = AccentBlue) {
                onNavigateToProjects()
            }
        }
    }
}

@Composable
fun MoreNavigationItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    color: Color,
    onClick: () -> Unit
) {
    Surface(
        color = SurfaceDark,
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 6.dp)
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(color.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(text = title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text(text = subtitle, color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}
