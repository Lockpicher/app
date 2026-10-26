package com.kubbonet.segundocerebro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.kubbonet.segundocerebro.ui.components.AppBottomBar
import com.kubbonet.segundocerebro.ui.components.AuthDialog
import com.kubbonet.segundocerebro.ui.components.QuickCreateBottomSheet
import com.kubbonet.segundocerebro.ui.components.Screen
import com.kubbonet.segundocerebro.ui.screens.CalendarScreen
import com.kubbonet.segundocerebro.ui.screens.HabitsScreen
import com.kubbonet.segundocerebro.ui.screens.HomeScreen
import com.kubbonet.segundocerebro.ui.screens.MoreDrawerScreen
import com.kubbonet.segundocerebro.ui.screens.NotebooksScreen
import com.kubbonet.segundocerebro.ui.screens.ProjectsScreen
import com.kubbonet.segundocerebro.ui.screens.TasksScreen
import com.kubbonet.segundocerebro.ui.theme.DarkBackground
import com.kubbonet.segundocerebro.ui.theme.SegundoCerebroColorScheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as SegundoCerebroApp
        val viewModel = app.viewModel

        setContent {
            MaterialTheme(colorScheme = SegundoCerebroColorScheme) {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

                var showQuickCreate by remember { mutableStateOf(false) }
                var showAuthDialog by remember { mutableStateOf(false) }

                Scaffold(
                    containerColor = DarkBackground,
                    bottomBar = {
                        AppBottomBar(
                            currentRoute = currentRoute,
                            onNavigate = { route ->
                                navController.navigate(route) {
                                    popUpTo(Screen.Home.route) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            onQuickCreateClick = { showQuickCreate = true }
                        )
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = innerPadding.calculateBottomPadding())
                    ) {
                        NavHost(
                            navController = navController,
                            startDestination = Screen.Home.route
                        ) {
                            composable(Screen.Home.route) {
                                HomeScreen(
                                    viewModel = viewModel,
                                    onNavigateToTasks = { navController.navigate(Screen.Tasks.route) },
                                    onNavigateToNotebooks = { navController.navigate(Screen.Notebooks.route) }
                                )
                            }
                            composable(Screen.Calendar.route) {
                                CalendarScreen(viewModel = viewModel)
                            }
                            composable(Screen.Tasks.route) {
                                TasksScreen(viewModel = viewModel)
                            }
                            composable(Screen.Notebooks.route) {
                                NotebooksScreen(viewModel = viewModel)
                            }
                            composable(Screen.Projects.route) {
                                ProjectsScreen(
                                    viewModel = viewModel,
                                    onBack = { navController.popBackStack() }
                                )
                            }
                            composable(Screen.Habits.route) {
                                HabitsScreen(
                                    viewModel = viewModel,
                                    onBack = { navController.popBackStack() }
                                )
                            }
                            composable(Screen.More.route) {
                                MoreDrawerScreen(
                                    viewModel = viewModel,
                                    onOpenAuthModal = { showAuthDialog = true },
                                    onNavigateToProjects = { navController.navigate(Screen.Projects.route) },
                                    onNavigateToHabits = { navController.navigate(Screen.Habits.route) }
                                )
                            }
                        }

                        if (showQuickCreate) {
                            QuickCreateBottomSheet(
                                onDismiss = { showQuickCreate = false },
                                onCreateNote = {
                                    viewModel.createQuickNote("Nueva Nota", "")
                                },
                                onCreateTask = {
                                    viewModel.createQuickTask("Nueva Tarea")
                                }
                            )
                        }

                        if (showAuthDialog) {
                            AuthDialog(
                                viewModel = viewModel,
                                onDismiss = { showAuthDialog = false }
                            )
                        }
                    }
                }
            }
        }
    }
}
