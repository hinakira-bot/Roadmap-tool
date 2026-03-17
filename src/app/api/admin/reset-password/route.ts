import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, newPassword } = body

    console.log('Reset password request:', { userId, email, hasPassword: !!newPassword })

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'パスワードは6文字以上にしてください' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Supabase URL:', supabaseUrl)
    console.log('Service Role Key exists:', !!serviceRoleKey)
    console.log('Service Role Key starts with:', serviceRoleKey?.substring(0, 20))

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    let targetUserId = userId

    if (!targetUserId && email) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      console.log('Profile lookup:', { profile, profileError })

      if (profileError) {
        return NextResponse.json({ error: 'プロフィール検索エラー: ' + profileError.message }, { status: 500 })
      }

      if (!profile) {
        return NextResponse.json({ error: 'このメールアドレスのアカウントが見つかりません' }, { status: 404 })
      }
      targetUserId = profile.id
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId または email が必要です' }, { status: 400 })
    }

    console.log('Updating user:', targetUserId)

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })

    console.log('Update result:', { updateData: !!updateData, updateError })

    if (updateError) {
      return NextResponse.json({ error: 'パスワード更新エラー: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Reset password error:', err)
    const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
