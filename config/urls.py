"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def health(request):
    # CI polls this after deploying to confirm Render is serving the new commit
    return JsonResponse({"status": "ok", "commit": settings.GIT_COMMIT})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health, name='health'),
    path('api/accounts/', include('accounts.urls')),
]
