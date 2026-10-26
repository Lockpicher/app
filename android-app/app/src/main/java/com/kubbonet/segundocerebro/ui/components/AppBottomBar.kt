package com.kubbonet.segundocerebro.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kubbonet.segundocerebro.ui.theme.*

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Home : Screen("home", "Inicio", Icons.Default.Home)
    object Calendar : Screen("calendar", "Calendario", Icons.Default.DateRange)
    object Tasks : Screen("tasks", "Tareas", Icons.Default.CheckCircle)
    object Notebooks : Screen("notebooks", "Cuadernos", Icons.Default.Book)
    object More : Screen("more", "Más", Icons.Default.Menu)
    object Projects : Screen("projects", "Proyectos", Icons.Default.Folder)
    object Habits : Screen("habits", "Hábitos", Icons.Default.Timeline)
}

@Composable
fun AppBottomBar(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    onQuickCreateClick: () -> Unit
) {
    Surface(
        color = SurfaceDark,
        tonalElevation = 8.dp,
        modifier = Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 1. Inicio
            BottomNavItem(
                screen = Screen.Home,
                isSelected = currentRoute == Screen.Home.route,
                onClick = { onNavigate(Screen.Home.route) }
            )

            // 2. Calendario
            BottomNavItem(
                screen = Screen.Calendar,
                isSelected = currentRoute == Screen.Calendar.route,
                onClick = { onNavigate(Screen.Calendar.route) }
            )

            // 3. Botón Central Quick Create (+)
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(AccentBlue)
                    .clickable { onQuickCreateClick() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Crear nuevo",
                    tint = Color.White,
                    modifier = Modifier.size(26.dp)
                )
            }

            // 4. Tareas
            BottomNavItem(
                screen = Screen.Tasks,
                isSelected = currentRoute == Screen.Tasks.route,
                onClick = { onNavigate(Screen.Tasks.route) }
            )

            // 5. Más
            BottomNavItem(
                screen = Screen.More,
                isSelected = currentRoute == Screen.More.route,
                onClick = { onNavigate(Screen.More.route) }
            )
        }
    }
}

@Composable
fun BottomNavItem(
    screen: Screen,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Icon(
            imageVector = screen.icon,
            contentDescription = screen.title,
            tint = if (isSelected) AccentBlue else TextMuted,
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = screen.title,
            color = if (isSelected) AccentBlue else TextMuted,
            fontSize = 11.sp
        )
    }
}
