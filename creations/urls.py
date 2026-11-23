from django.urls import path
from . import views

urlpatterns = [
    path("", views.list_creations, name="list_creations"),
    path("mine/", views.my_creations, name="my_creations"),
    path("create/", views.create_creation, name="create_creation"),
    path("<str:creation_id>/", views.creation_detail, name="creation_detail"),
]