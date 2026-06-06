from django import forms
from django.contrib.auth import get_user_model

from employee.forms import ArticleForm

User = get_user_model()


class EmployeeCreateForm(forms.ModelForm):
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
        min_length=6,
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password')
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
        }

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password'])
        user.is_staff = True
        if commit:
            user.save()
        return user


class AdminArticleForm(ArticleForm):
    class Meta(ArticleForm.Meta):
        fields = ArticleForm.Meta.fields + ('author',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['author'].queryset = User.objects.filter(is_staff=True)
        self.fields['author'].widget.attrs['class'] = 'form-select'
