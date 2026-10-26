package com.kubbonet.segundocerebro.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kubbonet.segundocerebro.ui.theme.*
import com.kubbonet.segundocerebro.viewmodel.AuthState
import com.kubbonet.segundocerebro.viewmodel.MainViewModel

@Composable
fun AuthDialog(
    viewModel: MainViewModel,
    onDismiss: () -> Unit
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val isLoading by viewModel.isLoading.collectAsState()
    val authState by viewModel.authState.collectAsState()

    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated) {
            onDismiss()
        }
    }

    AlertDialog(
        onDismissRequest = { onDismiss() },
        containerColor = SurfaceDark,
        title = {
            Text(
                text = "Iniciar Sesión / Acceso",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Ingresa tu email o usuario. Si hay error de red o no existe cuenta, se iniciará sesión local instantánea.",
                    color = TextSecondary,
                    fontSize = 12.sp
                )

                TextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    placeholder = { Text("Correo o nombre de usuario") },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                TextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = { Text("Contraseña") },
                    visualTransformation = PasswordVisualTransformation(),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (isLoading) {
                    LinearProgressIndicator(color = AccentBlue, modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (identifier.isNotBlank()) {
                        viewModel.login(identifier, password.ifBlank { "123456" })
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
                enabled = !isLoading
            ) {
                Text(if (isLoading) "Entrando..." else "Entrar")
            }
        },
        dismissButton = {
            TextButton(onClick = { onDismiss() }) {
                Text("Cancelar", color = TextSecondary)
            }
        }
    )
}
