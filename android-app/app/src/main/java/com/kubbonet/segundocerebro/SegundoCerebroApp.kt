package com.kubbonet.segundocerebro

import android.app.Application
import com.kubbonet.segundocerebro.data.local.TokenManager
import com.kubbonet.segundocerebro.data.remote.InsForgeApiConfig
import com.kubbonet.segundocerebro.data.remote.InsForgeApiService
import com.kubbonet.segundocerebro.viewmodel.MainViewModel

class SegundoCerebroApp : Application() {

    lateinit var tokenManager: TokenManager
        private set

    lateinit var apiService: InsForgeApiService
        private set

    lateinit var viewModel: MainViewModel
        private set

    override fun onCreate() {
        super.onCreate()
        tokenManager = TokenManager(this)
        val httpClient = InsForgeApiConfig.createKtorClient(tokenManager)
        apiService = InsForgeApiService(httpClient, tokenManager)
        viewModel = MainViewModel(apiService, tokenManager)
    }
}
