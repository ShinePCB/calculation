(module
  (import "env" "log" (func $log (param f64) (result f64)))
  (import "env" "exp" (func $exp (param f64) (result f64)))
  (import "env" "pow" (func $pow (param f64 f64) (result f64)))

  (func $effective_width (param $h f64) (param $w f64) (param $t f64) (result f64)
    (local $ratio f64)
    local.get $t
    f64.const 0
    f64.le
    if (result f64)
      local.get $w
    else
      local.get $w
      local.get $t
      f64.const 3.141592653589793
      f64.div
      f64.const 1
      f64.const 4
      f64.const 3.141592653589793
      f64.mul
      local.get $w
      f64.mul
      local.get $t
      f64.div
      call $log
      f64.add
      f64.mul
      f64.add
    end)

  (func $microstrip_eeff (export "microstrip_eeff") (param $er f64) (param $h f64) (param $w f64) (param $t f64) (result f64)
    (local $u f64) (local $base f64) (local $contrast f64) (local $shape f64)
    local.get $h local.get $w local.get $t call $effective_width local.set $w
    local.get $w local.get $h f64.div local.set $u
    local.get $er f64.const 1 f64.add f64.const 2 f64.div local.set $base
    local.get $er f64.const 1 f64.sub f64.const 2 f64.div local.set $contrast
    f64.const 1 f64.const 1 f64.const 12 local.get $u f64.div f64.add f64.sqrt f64.div local.set $shape
    local.get $u f64.const 1 f64.lt
    if (result f64)
      f64.const 0.04 f64.const 1 local.get $u f64.sub f64.const 2 call $pow f64.mul
    else f64.const 0 end
    local.get $shape f64.add
    local.get $contrast f64.mul
    local.get $base f64.add)

  (func (export "microstrip_z0") (param $er f64) (param $h f64) (param $w f64) (param $t f64) (result f64)
    (local $u f64) (local $ee f64)
    local.get $er local.get $h local.get $w local.get $t call $microstrip_eeff local.set $ee
    local.get $h local.get $w local.get $t call $effective_width local.get $h f64.div local.set $u
    local.get $u f64.const 1 f64.le
    if (result f64)
      f64.const 60 local.get $ee f64.sqrt f64.div
      f64.const 8 local.get $u f64.div local.get $u f64.const 4 f64.div f64.add call $log f64.mul
    else
      f64.const 376.730313668 local.get $ee f64.sqrt f64.div
      local.get $u f64.const 1.393 f64.add
      f64.const 0.667 local.get $u f64.const 1.444 f64.add call $log f64.mul f64.add
      f64.div
    end)

  (func (export "stripline_z0") (param $er f64) (param $h f64) (param $w f64) (param $t f64) (result f64)
    f64.const 60 local.get $er f64.sqrt f64.div
    f64.const 1.9 local.get $h f64.mul
    f64.const 0.8 local.get $w f64.mul local.get $t f64.add f64.div
    call $log f64.mul)

  (func $agm (param $a f64) (param $b f64) (result f64)
    (local $i i32) (local $next f64)
    i32.const 0 local.set $i
    loop $again
      local.get $a local.get $b f64.add f64.const 2 f64.div local.set $next
      local.get $a local.get $b f64.mul f64.sqrt local.set $b
      local.get $next local.set $a
      local.get $i i32.const 1 i32.add local.tee $i i32.const 12 i32.lt_s br_if $again
    end
    local.get $a)

  (func (export "gcpw_z0") (param $er f64) (param $h f64) (param $w f64) (param $s f64) (result f64)
    (local $k f64) (local $kp f64) (local $ratio f64) (local $ee f64)
    local.get $w local.get $w f64.const 2 local.get $s f64.mul f64.add f64.div local.set $k
    f64.const 1 local.get $k local.get $k f64.mul f64.sub f64.sqrt local.set $kp
    f64.const 1 local.get $kp call $agm
    f64.const 1 local.get $k call $agm
    f64.div local.set $ratio
    local.get $er f64.const 1 f64.add f64.const 2 f64.div local.set $ee
    f64.const 94.2477796077 local.get $ee f64.sqrt f64.div local.get $ratio f64.mul)
)
